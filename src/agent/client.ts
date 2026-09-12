import {
  encodeRequest,
  isFireAndForget,
  parseAgentMessage,
  type AgentPermissions,
  type AgentPlatform,
  type Capability,
  type HelloMessage,
  type WebToAgentBody,
} from './protocol';

/**
 * 에이전트 WebSocket 클라이언트 (docs/AGENT-PROTOCOL.md §1·§2).
 *  - 에이전트가 서버. 연결 직후 hello 를 받기 전에는 요청을 보내지 않는다
 *  - 재연결 백오프 1→2→4→8s(최대). disconnect() 로 사용자가 끊으면 재연결하지 않는다
 *  - 요청은 id 로 응답과 매칭, 1500ms 안에 응답이 없으면 timeout
 *  - 30s 마다 ping, pong 이 두 번 연속 없으면 끊고 재연결
 * DOM 이 없어도 테스트할 수 있게 소켓 생성·타이머를 주입받는다.
 */
export type AgentStatus = 'disconnected' | 'connecting' | 'hello_wait' | 'ready' | 'error';

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
}

export interface AgentClientEvents {
  onStatus: (status: AgentStatus, detail?: string) => void;
  onHello?: (hello: HelloMessage) => void;
  onPermissions?: (permissions: AgentPermissions) => void;
  onPanic?: () => void;
}

export interface AgentClientOptions {
  createSocket?: (url: string) => SocketLike;
  timeoutMs?: number;
  pingIntervalMs?: number;
  backoffMs?: number[];
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}

const OPEN = 1;

export const DEFAULT_BACKOFF_MS = [1000, 2000, 4000, 8000];
export const REQUEST_TIMEOUT_MS = 1500;
export const PING_INTERVAL_MS = 30_000;

interface Pending {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: unknown;
}

export class AgentClient {
  status: AgentStatus = 'disconnected';
  hello: HelloMessage | null = null;
  private url = '';
  private socket: SocketLike | null = null;
  private wanted = false;
  private attempt = 0;
  private reconnectTimer: unknown = null;
  private pingTimer: unknown = null;
  private missedPongs = 0;
  private pending = new Map<string, Pending>();
  private readonly opts: Required<Omit<AgentClientOptions, 'createSocket'>> & { createSocket: (url: string) => SocketLike };

  constructor(
    private events: AgentClientEvents,
    opts: AgentClientOptions = {},
  ) {
    this.opts = {
      createSocket: opts.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike),
      timeoutMs: opts.timeoutMs ?? REQUEST_TIMEOUT_MS,
      pingIntervalMs: opts.pingIntervalMs ?? PING_INTERVAL_MS,
      backoffMs: opts.backoffMs ?? DEFAULT_BACKOFF_MS,
      setTimeout: opts.setTimeout ?? ((fn, ms) => setTimeout(fn, ms)),
      clearTimeout: opts.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)),
    };
  }

  get platform(): AgentPlatform | null {
    return this.hello?.platform ?? null;
  }

  get capabilities(): Capability[] {
    return this.hello?.capabilities ?? [];
  }

  /** hello 를 받은 뒤, 해당 capability 가 있을 때만 */
  canSend(cap: Capability): boolean {
    return this.status === 'ready' && this.capabilities.includes(cap) && !!this.socket && this.socket.readyState === OPEN;
  }

  connect(url: string): void {
    this.url = url;
    this.wanted = true;
    this.attempt = 0;
    this.open();
  }

  /** 사용자가 끊음. 재연결하지 않는다 */
  disconnect(): void {
    this.wanted = false;
    this.clearTimers();
    this.teardownSocket();
    this.failAllPending('연결 끊김');
    this.setStatus('disconnected');
  }

  /** 지금 즉시 다시 시도 (백오프 무시) */
  retryNow(): void {
    if (!this.wanted) return;
    this.clearReconnect();
    this.attempt = 0;
    this.open();
  }

  /**
   * 요청을 보내고 응답을 기다린다. hello 전·capability 없음이면 즉시 reject.
   * ack:false 메시지(move)는 보내자마자 resolve.
   */
  request(body: WebToAgentBody): Promise<void> {
    const cap = body.type === 'ping' || body.type === 'whitelist' ? null : body.type;
    if (this.status !== 'ready' || !this.socket || this.socket.readyState !== OPEN) return Promise.reject(new Error('에이전트 연결 안 됨'));
    if (cap && !this.capabilities.includes(cap as Capability)) return Promise.reject(new Error(`에이전트가 ${cap} 을(를) 지원하지 않음`));

    const { id, text } = encodeRequest(body);
    try {
      this.socket.send(text);
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
    if (isFireAndForget(body)) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const timer = this.opts.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('에이전트 응답 없음 (timeout)'));
      }, this.opts.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  /* ---------------- 내부 ---------------- */

  private setStatus(status: AgentStatus, detail?: string): void {
    this.status = status;
    this.events.onStatus(status, detail);
  }

  private open(): void {
    this.teardownSocket();
    this.setStatus('connecting');
    let sock: SocketLike;
    try {
      sock = this.opts.createSocket(this.url);
    } catch (err) {
      this.scheduleReconnect(err instanceof Error ? err.message : String(err));
      return;
    }
    this.socket = sock;
    sock.onopen = () => {
      if (this.socket !== sock) return;
      this.setStatus('hello_wait');
    };
    sock.onmessage = (ev) => {
      if (this.socket !== sock) return;
      this.handleMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
    };
    sock.onerror = () => {
      // onclose 가 뒤따른다. 여기서는 아무것도 하지 않는다
    };
    sock.onclose = () => {
      if (this.socket !== sock) return;
      this.socket = null;
      this.hello = null;
      this.clearPing();
      this.failAllPending('연결 끊김');
      if (this.wanted) this.scheduleReconnect();
      else this.setStatus('disconnected');
    };
  }

  private handleMessage(raw: string): void {
    const msg = parseAgentMessage(raw);
    if (!msg) return; // 알 수 없는 메시지는 무시 (전방 호환)

    if ('type' in msg && msg.type === 'hello') {
      this.hello = msg;
      this.attempt = 0;
      this.missedPongs = 0;
      this.setStatus('ready');
      this.events.onHello?.(msg);
      this.startPing();
      return;
    }
    if ('type' in msg && msg.type === 'permissions') {
      if (this.hello) this.hello = { ...this.hello, permissions: msg.permissions };
      this.events.onPermissions?.(msg.permissions);
      return;
    }
    if ('type' in msg && msg.type === 'panic') {
      this.events.onPanic?.();
      return;
    }
    if ('type' in msg && msg.type === 'pong') {
      this.missedPongs = 0;
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        this.opts.clearTimeout(p.timer);
        p.resolve();
      }
      return;
    }
    if ('ok' in msg) {
      if (!msg.id) return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      this.opts.clearTimeout(p.timer);
      if (msg.ok) p.resolve();
      else p.reject(new Error(msg.message ? `${msg.error}: ${msg.message}` : msg.error));
    }
  }

  private startPing(): void {
    this.clearPing();
    const tick = () => {
      if (this.status !== 'ready') return;
      this.missedPongs++;
      if (this.missedPongs > 2) {
        // pong 두 번 연속 없음 → 끊고 재연결
        this.teardownSocket();
        this.hello = null;
        this.failAllPending('에이전트 응답 없음');
        if (this.wanted) this.scheduleReconnect('ping 응답 없음');
        return;
      }
      this.request({ type: 'ping' }).catch(() => undefined);
      this.pingTimer = this.opts.setTimeout(tick, this.opts.pingIntervalMs);
    };
    this.pingTimer = this.opts.setTimeout(tick, this.opts.pingIntervalMs);
  }

  private scheduleReconnect(detail?: string): void {
    this.clearReconnect();
    const delay = this.opts.backoffMs[Math.min(this.attempt, this.opts.backoffMs.length - 1)];
    this.attempt++;
    this.setStatus('disconnected', detail ?? `재연결 ${delay / 1000}s 후`);
    this.reconnectTimer = this.opts.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wanted) this.open();
    }, delay);
  }

  private teardownSocket(): void {
    const s = this.socket;
    this.socket = null;
    if (!s) return;
    s.onopen = null;
    s.onmessage = null;
    s.onclose = null;
    s.onerror = null;
    try {
      s.close();
    } catch {
      // 이미 닫힘
    }
  }

  private failAllPending(reason: string): void {
    for (const [id, p] of this.pending) {
      this.opts.clearTimeout(p.timer);
      p.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  private clearPing(): void {
    if (this.pingTimer !== null) this.opts.clearTimeout(this.pingTimer);
    this.pingTimer = null;
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) this.opts.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearTimers(): void {
    this.clearPing();
    this.clearReconnect();
  }
}

export function agentUrl(port: number): string {
  return `ws://127.0.0.1:${port}`;
}

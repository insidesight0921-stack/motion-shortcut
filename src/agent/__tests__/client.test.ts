import { describe, expect, it, vi } from 'vitest';
import { AgentClient, type AgentStatus, type SocketLike } from '../client';

/** 가짜 소켓 + 수동 타이머 */
class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  closed = false;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  // 테스트 도우미
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
  last(): Record<string, unknown> {
    return JSON.parse(this.sent[this.sent.length - 1]);
  }
}

function harness(opts: { backoffMs?: number[] } = {}) {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number; id: number }[] = [];
  let nextId = 1;
  const statuses: AgentStatus[] = [];
  const events = { onStatus: (s: AgentStatus) => statuses.push(s), onHello: vi.fn(), onPermissions: vi.fn(), onPanic: vi.fn() };
  const client = new AgentClient(events, {
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    timeoutMs: 1500,
    pingIntervalMs: 30_000,
    backoffMs: opts.backoffMs,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.push({ fn, ms, id });
      return id;
    },
    clearTimeout: (h) => {
      const i = timers.findIndex((t) => t.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  const fire = (pred?: (t: { ms: number }) => boolean) => {
    const i = pred ? timers.findIndex(pred) : 0;
    if (i < 0) throw new Error('no timer');
    const [t] = timers.splice(i, 1);
    t.fn();
    return t.ms;
  };
  const hello = (s: FakeSocket, caps = ['key', 'panel']) =>
    s.receive({ v: 1, type: 'hello', agent: 'mock/1', platform: 'darwin', capabilities: caps, permissions: { accessibility: true } });
  return { client, sockets, timers, fire, statuses, events, hello };
}

describe('연결과 hello', () => {
  it('connect → connecting → (open) hello_wait → (hello) ready. hello 전에는 요청을 거부한다', async () => {
    const h = harness();
    h.client.connect('ws://127.0.0.1:41777');
    const s = h.sockets[0];
    expect(h.client.status).toBe('connecting');
    s.open();
    expect(h.client.status).toBe('hello_wait');
    await expect(h.client.request({ type: 'key', combo: 'ArrowRight' })).rejects.toThrow('연결 안 됨');
    h.hello(s);
    expect(h.client.status).toBe('ready');
    expect(h.events.onHello).toHaveBeenCalledTimes(1);
    expect(h.client.canSend('key')).toBe(true);
    expect(h.client.canSend('laser')).toBe(false);
  });

  it('capability 에 없는 요청은 보내지 않고 거부한다', async () => {
    const h = harness();
    h.client.connect('ws://x');
    const s = h.sockets[0];
    s.open();
    h.hello(s, ['panel']);
    await expect(h.client.request({ type: 'key', combo: 'B' })).rejects.toThrow('지원하지 않음');
    expect(s.sent).toEqual([]);
  });
});

describe('요청/응답', () => {
  it('id 로 매칭해 ok:true 면 resolve, ok:false 면 reject', async () => {
    const h = harness();
    h.client.connect('ws://x');
    const s = h.sockets[0];
    s.open();
    h.hello(s);
    const p1 = h.client.request({ type: 'key', combo: 'ArrowRight' });
    const m1 = s.last();
    expect(m1).toMatchObject({ v: 1, type: 'key', combo: 'ArrowRight' });
    s.receive({ v: 1, id: m1.id, ok: true });
    await expect(p1).resolves.toBeUndefined();

    const p2 = h.client.request({ type: 'key', combo: 'B' });
    s.receive({ v: 1, id: s.last().id, ok: false, error: 'accessibility_permission_missing', message: '설정에서 허용' });
    await expect(p2).rejects.toThrow('accessibility_permission_missing: 설정에서 허용');
  });

  it('1500ms 안에 응답이 없으면 timeout 으로 reject', async () => {
    const h = harness();
    h.client.connect('ws://x');
    const s = h.sockets[0];
    s.open();
    h.hello(s);
    const p = h.client.request({ type: 'key', combo: 'ArrowRight' });
    const ms = h.fire((t) => t.ms === 1500);
    expect(ms).toBe(1500);
    await expect(p).rejects.toThrow('timeout');
  });

  it('ack:false 인 move 는 보내자마자 resolve 하고 대기 목록에 남지 않는다', async () => {
    const h = harness();
    h.client.connect('ws://x');
    const s = h.sockets[0];
    s.open();
    h.hello(s, ['cursor']);
    await expect(h.client.request({ type: 'cursor', action: 'move', x: 0.5, y: 0.5, ack: false })).resolves.toBeUndefined();
    expect(h.timers.filter((t) => t.ms === 1500)).toHaveLength(0);
  });

  it('연결이 끊기면 대기 중 요청은 모두 reject', async () => {
    const h = harness();
    h.client.connect('ws://x');
    const s = h.sockets[0];
    s.open();
    h.hello(s);
    const p = h.client.request({ type: 'key', combo: 'ArrowRight' });
    s.drop();
    await expect(p).rejects.toThrow('연결 끊김');
  });
});

describe('재연결 백오프', () => {
  it('끊기면 1→2→4→8→8s 간격으로 다시 연다. hello 를 받으면 카운터가 리셋된다', () => {
    const h = harness();
    h.client.connect('ws://x');
    const delays: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = h.sockets[h.sockets.length - 1];
      s.open();
      s.drop();
      delays.push(h.fire((t) => [1000, 2000, 4000, 8000].includes(t.ms)));
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 8000]);
    expect(h.sockets).toHaveLength(6);
    // hello 후 끊기면 다시 1s 부터
    const s = h.sockets[5];
    s.open();
    h.hello(s);
    s.drop();
    expect(h.fire((t) => [1000, 2000, 4000, 8000].includes(t.ms))).toBe(1000);
  });

  it('disconnect() 뒤에는 재연결하지 않는다', () => {
    const h = harness();
    h.client.connect('ws://x');
    h.sockets[0].open();
    h.client.disconnect();
    expect(h.client.status).toBe('disconnected');
    expect(h.sockets[0].closed).toBe(true);
    expect(h.timers.filter((t) => [1000, 2000, 4000, 8000].includes(t.ms))).toHaveLength(0);
  });

  it('retryNow 는 백오프를 기다리지 않고 즉시 다시 연다', () => {
    const h = harness();
    h.client.connect('ws://x');
    h.sockets[0].open();
    h.sockets[0].drop();
    expect(h.sockets).toHaveLength(1);
    h.client.retryNow();
    expect(h.sockets).toHaveLength(2);
  });
});

describe('에이전트 발신 이벤트', () => {
  it('panic → onPanic, permissions → onPermissions (hello 갱신), ping/pong', () => {
    const h = harness();
    h.client.connect('ws://x');
    const s = h.sockets[0];
    s.open();
    h.hello(s);
    s.receive({ v: 1, type: 'panic' });
    expect(h.events.onPanic).toHaveBeenCalledTimes(1);
    s.receive({ v: 1, type: 'permissions', permissions: { accessibility: false } });
    expect(h.events.onPermissions).toHaveBeenCalledWith({ accessibility: false, screenRecording: null });
    expect(h.client.hello?.permissions.accessibility).toBe(false);

    // 30s ping
    h.fire((t) => t.ms === 30_000);
    expect(s.last()).toMatchObject({ type: 'ping' });
  });

  it('pong 이 두 번 연속 없으면 끊고 재연결한다', () => {
    const h = harness();
    h.client.connect('ws://x');
    const s = h.sockets[0];
    s.open();
    h.hello(s);
    h.fire((t) => t.ms === 30_000); // ping 1 (missed=1)
    h.fire((t) => t.ms === 30_000); // ping 2 (missed=2)
    h.fire((t) => t.ms === 30_000); // missed=3 → 끊음
    expect(s.closed).toBe(true);
    expect(h.client.status).toBe('disconnected');
    expect(h.timers.some((t) => t.ms === 1000)).toBe(true);
  });
});

/**
 * 웹앱 ↔ 로컬 에이전트 프로토콜 v1 타입과 검증. 문서: docs/AGENT-PROTOCOL.md (문서가 계약, 이 파일은 그 구현).
 * 삭제·이동·종료 계열 메시지는 존재하지 않는다 (D-017).
 */
export const PROTOCOL_VERSION = 1 as const;

export type Capability = 'key' | 'cursor' | 'laser' | 'open' | 'panel';
export const ALL_CAPABILITIES: Capability[] = ['key', 'cursor', 'laser', 'open', 'panel'];

export type AgentPlatform = 'darwin' | 'win32' | 'linux';

export interface AgentPermissions {
  accessibility: boolean;
  screenRecording?: boolean | null;
}

export interface AgentDisplay {
  id: number;
  w: number;
  h: number;
  primary: boolean;
}

/* ---------------- 웹앱 → 에이전트 ---------------- */

export interface KeyRequest {
  type: 'key';
  combo: string;
}
export interface CursorMoveRequest {
  type: 'cursor';
  action: 'move';
  x: number;
  y: number;
  ack?: false;
}
export interface CursorClickRequest {
  type: 'cursor';
  action: 'click';
  button: 'left';
}
export interface CursorScrollRequest {
  type: 'cursor';
  action: 'scroll';
  dy: number;
}
export interface LaserRequest {
  type: 'laser';
  action: 'show' | 'move' | 'hide';
  x?: number;
  y?: number;
  emphasis?: 0 | 1;
  ack?: false;
}
export interface OpenRequest {
  type: 'open';
  target: { kind: 'url' | 'file' | 'app'; value: string; label?: string };
}
export interface PanelState {
  mode: 'slide' | 'cursor' | 'laser' | 'asset' | 'standby';
  motion: 'on' | 'off';
  camera: 'on' | 'off';
  candidate?: string | null;
  progress?: number;
  lastCommand?: string | null;
  lastCommandAt?: number;
  laser?: { size: 'sm' | 'md' | 'lg'; color: 'blue' | 'red' };
}
export interface PanelRequest {
  type: 'panel';
  state: PanelState;
}
export interface WhitelistRequest {
  type: 'whitelist';
  items: { kind: 'url' | 'file' | 'app'; value: string }[];
}
export interface PingRequest {
  type: 'ping';
}

export type WebToAgentBody =
  | KeyRequest
  | CursorMoveRequest
  | CursorClickRequest
  | CursorScrollRequest
  | LaserRequest
  | OpenRequest
  | PanelRequest
  | WhitelistRequest
  | PingRequest;

export type WebToAgent = WebToAgentBody & { v: typeof PROTOCOL_VERSION; id: string };

/* ---------------- 에이전트 → 웹앱 ---------------- */

export type AgentErrorCode =
  | 'accessibility_permission_missing'
  | 'not_whitelisted'
  | 'unsupported_type'
  | 'unsupported_version'
  | 'invalid_message'
  | 'internal';

export const AGENT_ERROR_LABEL: Record<AgentErrorCode, string> = {
  accessibility_permission_missing: '손쉬운 사용 권한 없음',
  not_whitelisted: '등록되지 않은 자료',
  unsupported_type: '에이전트 미지원 명령',
  unsupported_version: '프로토콜 버전 불일치',
  invalid_message: '메시지 형식 오류',
  internal: '에이전트 내부 오류',
};

export function describeAgentError(code: string, message?: string): string {
  const label = (AGENT_ERROR_LABEL as Record<string, string>)[code] ?? `에이전트 오류 (${code})`;
  return message ? `${label} · ${message}` : label;
}

export interface HelloMessage {
  v: 1;
  type: 'hello';
  agent?: string;
  platform: AgentPlatform;
  capabilities: Capability[];
  permissions: AgentPermissions;
  displays?: AgentDisplay[];
}
export interface AckMessage {
  v: 1;
  id: string;
  ok: true;
}
export interface NackMessage {
  v: 1;
  id?: string;
  ok: false;
  error: string;
  message?: string;
}
export interface PermissionsMessage {
  v: 1;
  type: 'permissions';
  permissions: AgentPermissions;
}
export interface PanicMessage {
  v: 1;
  type: 'panic';
}
export interface PongMessage {
  v: 1;
  type: 'pong';
  id: string;
}

export type AgentToWeb = HelloMessage | AckMessage | NackMessage | PermissionsMessage | PanicMessage | PongMessage;

/* ---------------- 검증 ---------------- */

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function isCapability(v: unknown): v is Capability {
  return typeof v === 'string' && (ALL_CAPABILITIES as string[]).includes(v);
}

function normalizePermissions(v: unknown): AgentPermissions {
  const p = isObj(v) ? v : {};
  return {
    accessibility: p.accessibility === true,
    screenRecording: typeof p.screenRecording === 'boolean' ? p.screenRecording : null,
  };
}

/** 에이전트가 보낸 텍스트 프레임 → 메시지. 모르는 형식·버전이면 null */
export function parseAgentMessage(raw: string): AgentToWeb | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(data) || data.v !== PROTOCOL_VERSION) return null;

  if (data.type === 'hello') {
    const platform = data.platform === 'darwin' || data.platform === 'win32' || data.platform === 'linux' ? data.platform : null;
    if (!platform) return null;
    const caps = Array.isArray(data.capabilities) ? data.capabilities.filter(isCapability) : [];
    const displays = Array.isArray(data.displays)
      ? data.displays
          .filter(isObj)
          .map((d) => ({ id: Number(d.id), w: Number(d.w), h: Number(d.h), primary: d.primary === true }))
          .filter((d) => Number.isFinite(d.w) && Number.isFinite(d.h))
      : undefined;
    return {
      v: 1,
      type: 'hello',
      agent: typeof data.agent === 'string' ? data.agent : undefined,
      platform,
      capabilities: caps,
      permissions: normalizePermissions(data.permissions),
      displays,
    };
  }
  if (data.type === 'permissions') return { v: 1, type: 'permissions', permissions: normalizePermissions(data.permissions) };
  if (data.type === 'panic') return { v: 1, type: 'panic' };
  if (data.type === 'pong' && typeof data.id === 'string') return { v: 1, type: 'pong', id: data.id };
  if (data.ok === true && typeof data.id === 'string') return { v: 1, id: data.id, ok: true };
  if (data.ok === false && typeof data.error === 'string') {
    return { v: 1, id: typeof data.id === 'string' ? data.id : undefined, ok: false, error: data.error, message: typeof data.message === 'string' ? data.message : undefined };
  }
  return null;
}

export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 요청 본문에 v·id 를 붙여 직렬화 */
export function encodeRequest(body: WebToAgentBody, id: string = newRequestId()): { id: string; text: string } {
  const msg: WebToAgent = { v: PROTOCOL_VERSION, id, ...body } as WebToAgent;
  return { id, text: JSON.stringify(msg) };
}

/** 응답을 기다리지 않아도 되는 메시지 (cursor/laser move) */
export function isFireAndForget(body: WebToAgentBody): boolean {
  return (body.type === 'cursor' && body.action === 'move' && body.ack === false) || (body.type === 'laser' && body.action === 'move' && body.ack === false);
}

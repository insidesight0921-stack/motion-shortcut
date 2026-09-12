import { dispatchKeyCombo, parseKeyCombo } from '../commands/keyPress';
import type { Platform } from '../commands/programs';

/**
 * 명령의 실행 출구. 에이전트가 연결돼 있고 해당 capability 가 있으면 에이전트로, 아니면 페이지 안 폴백.
 *
 * 명령 실행은 동기(run(): CommandResult)인데 에이전트 왕복은 비동기다. 그래서 전송 즉시
 * "에이전트로 보냄"을 성공으로 돌려주고, 응답 실패(타임아웃·권한 없음)는 나중에 onAsyncFailure 로 따로 알린다.
 * 로그에는 두 줄이 남는다: 실행(전송) → 필요 시 실행 실패(응답).
 *
 * 페이지 안 폴백은 발표 프로그램에 닿지 않는다(isTrusted=false, D-015). 웹앱 단독 데모용이다.
 */
export type Via = 'agent' | 'page';

export interface KeyTransport {
  /** 에이전트가 지금 key 요청을 받을 수 있는가 (연결됨 + hello 수신 + capability 'key') */
  canSend(): boolean;
  platform(): Platform | null;
  /** 성공하면 resolve, 에이전트가 ok:false 또는 타임아웃이면 reject(Error(사유)) */
  sendKey(combo: string): Promise<void>;
}

export interface DispatchResult {
  ok: boolean;
  via: Via;
  message: string;
}

export type AsyncFailureHandler = (info: { combo: string; error: string }) => void;

let transport: KeyTransport | null = null;
let onAsyncFailure: AsyncFailureHandler | null = null;

export function setKeyTransport(t: KeyTransport | null): void {
  transport = t;
}

export function setAsyncFailureHandler(h: AsyncFailureHandler | null): void {
  onAsyncFailure = h;
}

export function currentPlatform(): Platform | null {
  return transport?.canSend() ? transport.platform() : null;
}

export function viaLabel(via: Via): string {
  return via === 'agent' ? '에이전트' : '페이지 안 폴백';
}

/** 키 조합 하나를 보낸다 */
export function sendKeyCombo(combo: string): DispatchResult {
  const parsed = parseKeyCombo(combo);
  if (!parsed) return { ok: false, via: 'page', message: `키 조합을 해석할 수 없음: ${combo}` };

  if (transport && transport.canSend()) {
    transport.sendKey(combo).catch((err: unknown) => {
      onAsyncFailure?.({ combo, error: err instanceof Error ? err.message : String(err) });
    });
    return { ok: true, via: 'agent', message: `${combo} → 에이전트` };
  }

  if (typeof document === 'undefined') return { ok: false, via: 'page', message: 'DOM 없음' };
  dispatchKeyCombo(parsed);
  return { ok: true, via: 'page', message: `${combo} → 페이지 안 폴백` };
}

/** 여러 키를 순서대로 (goto: 자릿수 + Enter). 하나라도 실패하면 거기서 멈춘다 */
export function sendKeySequence(combos: string[]): DispatchResult {
  let via: Via = 'page';
  for (const c of combos) {
    const r = sendKeyCombo(c);
    if (!r.ok) return r;
    via = r.via;
  }
  return { ok: true, via, message: `${combos.join(' ')} → ${viaLabel(via)}` };
}

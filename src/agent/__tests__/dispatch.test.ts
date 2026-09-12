import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendKeyCombo, sendKeySequence, setAsyncFailureHandler, setKeyTransport, type KeyTransport } from '../dispatch';

function fakeTransport(opts: { can?: boolean; fail?: string } = {}) {
  const sent: string[] = [];
  const t: KeyTransport = {
    canSend: () => opts.can ?? true,
    platform: () => 'darwin',
    sendKey: (combo) => {
      sent.push(combo);
      return opts.fail ? Promise.reject(new Error(opts.fail)) : Promise.resolve();
    },
  };
  return { t, sent };
}

afterEach(() => {
  setKeyTransport(null);
  setAsyncFailureHandler(null);
});

describe('sendKeyCombo', () => {
  it('에이전트가 보낼 수 있으면 에이전트로 (via agent)', () => {
    const { t, sent } = fakeTransport();
    setKeyTransport(t);
    const r = sendKeyCombo('ArrowRight');
    expect(r).toEqual({ ok: true, via: 'agent', message: 'ArrowRight → 에이전트' });
    expect(sent).toEqual(['ArrowRight']);
  });

  it('에이전트가 없거나 못 보내면 페이지 안 폴백 (node 환경에서는 DOM 없음 → 실패로 보고)', () => {
    const r1 = sendKeyCombo('ArrowRight');
    expect(r1.via).toBe('page');
    expect(r1.ok).toBe(false); // vitest node 환경: document 없음
    const { t, sent } = fakeTransport({ can: false });
    setKeyTransport(t);
    const r2 = sendKeyCombo('ArrowRight');
    expect(r2.via).toBe('page');
    expect(sent).toEqual([]);
  });

  it('해석할 수 없는 조합은 어디로도 보내지 않는다', () => {
    const { t, sent } = fakeTransport();
    setKeyTransport(t);
    const r = sendKeyCombo('Shift+');
    expect(r.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  it('에이전트 응답 실패는 비동기로 onAsyncFailure 에 전달된다 (로그 두 줄 모델)', async () => {
    const { t } = fakeTransport({ fail: 'accessibility_permission_missing' });
    setKeyTransport(t);
    const handler = vi.fn();
    setAsyncFailureHandler(handler);
    const r = sendKeyCombo('ArrowRight');
    expect(r.ok).toBe(true); // 전송 자체는 성공으로 기록
    await new Promise((res) => setTimeout(res, 0));
    expect(handler).toHaveBeenCalledWith({ combo: 'ArrowRight', error: 'accessibility_permission_missing' });
  });
});

describe('sendKeySequence', () => {
  it('순서대로 보내고 결과 메시지에 경로를 적는다', () => {
    const { t, sent } = fakeTransport();
    setKeyTransport(t);
    const r = sendKeySequence(['1', '2', 'Enter']);
    expect(r.ok).toBe(true);
    expect(sent).toEqual(['1', '2', 'Enter']);
    expect(r.message).toBe('1 2 Enter → 에이전트');
  });

  it('중간에 실패하면 거기서 멈춘다', () => {
    const { t, sent } = fakeTransport();
    setKeyTransport(t);
    const r = sendKeySequence(['1', 'Ctrl+', 'Enter']);
    expect(r.ok).toBe(false);
    expect(sent).toEqual(['1']);
  });
});

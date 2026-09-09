import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TIMER_MS, useTargetStore } from '../targetStore';

beforeEach(() => {
  useTargetStore.setState({ timer: { status: 'idle', durationMs: DEFAULT_TIMER_MS, endsAt: 0, remainingMs: DEFAULT_TIMER_MS } });
});

describe('타이머 (범용)', () => {
  it('시작 후 tick으로 남은 시간이 줄고, 시간이 다 되면 done', () => {
    const s = useTargetStore.getState();
    s.startTimer(1000);
    s.tickTimer(1000 + 60_000);
    expect(useTargetStore.getState().timer.remainingMs).toBe(DEFAULT_TIMER_MS - 60_000);
    s.tickTimer(1000 + DEFAULT_TIMER_MS + 1);
    expect(useTargetStore.getState().timer.status).toBe('done');
    expect(useTargetStore.getState().timer.remainingMs).toBe(0);
  });

  it('길이를 바꿔 시작할 수 있고, 정지해도 마지막 길이를 기억한다', () => {
    const s = useTargetStore.getState();
    expect(s.toggleTimer(0, 5 * 60_000)).toBe('started');
    expect(useTargetStore.getState().timer.durationMs).toBe(5 * 60_000);
    expect(s.toggleTimer(1000)).toBe('stopped');
    expect(useTargetStore.getState().timer).toMatchObject({ status: 'idle', durationMs: 5 * 60_000, remainingMs: 5 * 60_000 });
  });

  it('done 상태에서 toggle은 새로 시작한다', () => {
    const s = useTargetStore.getState();
    s.startTimer(0);
    s.tickTimer(DEFAULT_TIMER_MS);
    expect(useTargetStore.getState().timer.status).toBe('done');
    expect(s.toggleTimer(500_000)).toBe('started');
    expect(useTargetStore.getState().timer.status).toBe('running');
  });

  it('idle일 때 tick은 아무것도 하지 않는다', () => {
    const before = useTargetStore.getState().timer;
    useTargetStore.getState().tickTimer(99999);
    expect(useTargetStore.getState().timer).toBe(before);
  });
});

describe('마지막 키', () => {
  it('실제/합성 구분을 저장한다', () => {
    useTargetStore.getState().setLastKey({ combo: { key: 'ArrowRight', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false }, trusted: false, at: 1 });
    expect(useTargetStore.getState().lastKey?.trusted).toBe(false);
  });
});

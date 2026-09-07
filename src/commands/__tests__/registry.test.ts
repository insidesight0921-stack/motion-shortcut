import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_GESTURES } from '../../gesture/types';
import { cookingMode } from '../../modes/cooking/mapping';
import { TIMER_DURATION_MS, useCookingStore } from '../../store/cookingStore';
import { resolveCommand, runGesture } from '../registry';

const ctx = { now: 1_000_000 };

beforeEach(() => {
  useCookingStore.setState({
    stepIndex: 0,
    timer: { status: 'idle', durationMs: TIMER_DURATION_MS, endsAt: 0, remainingMs: TIMER_DURATION_MS },
    playerApi: null,
    playerReady: false,
    playerState: 'unstarted',
  });
});

describe('요리 모드 매핑', () => {
  it('fist를 제외한 4개 제스처가 명령에 매핑된다', () => {
    const mapped = ALL_GESTURES.filter((g) => resolveCommand(cookingMode, g) !== null);
    expect(mapped.sort()).toEqual(['circle', 'open_palm', 'swipe_left', 'swipe_right']);
    expect(resolveCommand(cookingMode, 'fist')).toBeNull();
  });

  it('기획서 표와 같다: 손바닥=재생토글, 오른쪽=다음, 왼쪽=이전, 원=타이머', () => {
    expect(resolveCommand(cookingMode, 'open_palm')?.id).toBe('video.toggle');
    expect(resolveCommand(cookingMode, 'swipe_right')?.id).toBe('recipe.next');
    expect(resolveCommand(cookingMode, 'swipe_left')?.id).toBe('recipe.prev');
    expect(resolveCommand(cookingMode, 'circle')?.id).toBe('timer.toggle');
  });
});

describe('runGesture', () => {
  it('fist는 null (모드 밖에서 처리)', () => {
    expect(runGesture(cookingMode, 'fist', ctx)).toBeNull();
  });

  it('오른쪽 스와이프는 다음 단계로, 마지막 단계에서는 ok:false', () => {
    const n = useCookingStore.getState().recipe.steps.length;
    for (let i = 1; i < n; i++) {
      const r = runGesture(cookingMode, 'swipe_right', ctx)!;
      expect(r.result.ok).toBe(true);
      expect(useCookingStore.getState().stepIndex).toBe(i);
    }
    const last = runGesture(cookingMode, 'swipe_right', ctx)!;
    expect(last.result.ok).toBe(false);
    expect(useCookingStore.getState().stepIndex).toBe(n - 1);
  });

  it('왼쪽 스와이프는 이전 단계로, 첫 단계에서는 ok:false', () => {
    expect(runGesture(cookingMode, 'swipe_left', ctx)!.result.ok).toBe(false);
    useCookingStore.getState().goToStep(2);
    expect(runGesture(cookingMode, 'swipe_left', ctx)!.result.ok).toBe(true);
    expect(useCookingStore.getState().stepIndex).toBe(1);
  });

  it('원은 타이머를 시작하고, 다시 원을 그리면 정지한다', () => {
    const a = runGesture(cookingMode, 'circle', ctx)!;
    expect(a.result.ok).toBe(true);
    expect(useCookingStore.getState().timer.status).toBe('running');
    expect(useCookingStore.getState().timer.endsAt).toBe(ctx.now + TIMER_DURATION_MS);
    const b = runGesture(cookingMode, 'circle', { now: ctx.now + 5000 })!;
    expect(b.result.ok).toBe(true);
    expect(useCookingStore.getState().timer.status).toBe('idle');
  });

  it('플레이어가 준비되지 않았으면 손바닥은 ok:false', () => {
    const r = runGesture(cookingMode, 'open_palm', ctx)!;
    expect(r.result.ok).toBe(false);
  });

  it('손바닥은 재생 중이면 일시정지, 아니면 재생', () => {
    const calls: string[] = [];
    let state: 'playing' | 'paused' = 'paused';
    useCookingStore.setState({
      playerReady: true,
      playerApi: {
        play: () => {
          calls.push('play');
          state = 'playing';
        },
        pause: () => {
          calls.push('pause');
          state = 'paused';
        },
        getState: () => state,
      },
    });
    runGesture(cookingMode, 'open_palm', ctx);
    runGesture(cookingMode, 'open_palm', ctx);
    runGesture(cookingMode, 'open_palm', ctx);
    expect(calls).toEqual(['play', 'pause', 'play']);
  });
});

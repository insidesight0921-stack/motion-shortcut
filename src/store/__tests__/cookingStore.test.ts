import { beforeEach, describe, expect, it } from 'vitest';
import { formatMs } from '../../modes/cooking/Timer';
import { parseYouTubeId } from '../../modes/cooking/youtubeId';
import { TIMER_DURATION_MS, useCookingStore } from '../cookingStore';

beforeEach(() => {
  useCookingStore.getState().stopTimer();
  useCookingStore.getState().goToStep(0);
});

describe('타이머', () => {
  it('시작 후 tick으로 남은 시간이 줄고, 시간이 다 되면 done', () => {
    const s = useCookingStore.getState();
    s.startTimer(1000);
    s.tickTimer(1000 + 60_000);
    expect(useCookingStore.getState().timer.remainingMs).toBe(TIMER_DURATION_MS - 60_000);
    s.tickTimer(1000 + TIMER_DURATION_MS + 1);
    expect(useCookingStore.getState().timer.status).toBe('done');
    expect(useCookingStore.getState().timer.remainingMs).toBe(0);
  });

  it('done 상태에서 toggle은 새로 시작한다', () => {
    const s = useCookingStore.getState();
    s.startTimer(0);
    s.tickTimer(TIMER_DURATION_MS);
    expect(useCookingStore.getState().timer.status).toBe('done');
    expect(s.toggleTimer(500_000)).toBe('started');
    expect(useCookingStore.getState().timer.status).toBe('running');
  });

  it('idle일 때 tick은 아무것도 하지 않는다', () => {
    const before = useCookingStore.getState().timer;
    useCookingStore.getState().tickTimer(99999);
    expect(useCookingStore.getState().timer).toBe(before);
  });
});

describe('단계 이동', () => {
  it('goToStep은 범위를 벗어나지 않는다', () => {
    const n = useCookingStore.getState().recipe.steps.length;
    useCookingStore.getState().goToStep(99);
    expect(useCookingStore.getState().stepIndex).toBe(n - 1);
    useCookingStore.getState().goToStep(-5);
    expect(useCookingStore.getState().stepIndex).toBe(0);
  });
});

describe('formatMs', () => {
  it('m:ss 형식, 올림', () => {
    expect(formatMs(180_000)).toBe('3:00');
    expect(formatMs(59_001)).toBe('1:00');
    expect(formatMs(5_000)).toBe('0:05');
    expect(formatMs(0)).toBe('0:00');
  });
});

describe('parseYouTubeId', () => {
  it('ID, watch URL, youtu.be, shorts, embed를 인식한다', () => {
    expect(parseYouTubeId('VhJFyyukAzA')).toBe('VhJFyyukAzA');
    expect(parseYouTubeId('https://www.youtube.com/watch?v=VhJFyyukAzA&t=10s')).toBe('VhJFyyukAzA');
    expect(parseYouTubeId('https://youtu.be/VhJFyyukAzA')).toBe('VhJFyyukAzA');
    expect(parseYouTubeId('https://www.youtube.com/shorts/WAle9soKZx8')).toBe('WAle9soKZx8');
    expect(parseYouTubeId('https://www.youtube.com/embed/VhJFyyukAzA')).toBe('VhJFyyukAzA');
  });

  it('엉뚱한 입력은 null', () => {
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId('hello world')).toBeNull();
    expect(parseYouTubeId('https://example.com/watch?v=VhJFyyukAzA')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/')).toBeNull();
  });
});

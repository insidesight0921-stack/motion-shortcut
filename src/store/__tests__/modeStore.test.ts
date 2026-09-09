import { beforeEach, describe, expect, it } from 'vitest';
import { gestureGate, MODE_SWITCH_COOLDOWN_MS, useModeStore } from '../modeStore';

beforeEach(() => {
  useModeStore.setState({ current: 'media', previous: null, switchedAt: 0, cooldownUntil: 0, lastSwitch: null });
});

describe('setMode', () => {
  it('전환 시 previous 기록과 1.5초 쿨다운 부여', () => {
    const ok = useModeStore.getState().setMode('presentation', 'voice', { utterance: '발표 모드', now: 10_000 });
    expect(ok).toBe(true);
    const s = useModeStore.getState();
    expect(s.current).toBe('presentation');
    expect(s.previous).toBe('media');
    expect(s.cooldownUntil).toBe(10_000 + MODE_SWITCH_COOLDOWN_MS);
    expect(s.lastSwitch).toMatchObject({ from: 'media', to: 'presentation', source: 'voice', utterance: '발표 모드' });
  });

  it('같은 모드로의 재설정은 false 이고 상태가 바뀌지 않는다', () => {
    expect(useModeStore.getState().setMode('media', 'ui')).toBe(false);
    expect(useModeStore.getState().previous).toBeNull();
  });
});

describe('gestureGate / gate', () => {
  it('정상 상태는 막지 않는다', () => {
    expect(gestureGate('media', 0, 1000)).toEqual({ blocked: false });
  });

  it('대기 중에는 항상 막는다 (주먹 포함)', () => {
    expect(gestureGate('standby', 0, 1000)).toEqual({ blocked: true, reason: '대기 모드' });
  });

  it('전환 직후 쿨다운 동안 막고, 지나면 푼다', () => {
    useModeStore.getState().setMode('reading', 'key', { now: 5000 });
    expect(useModeStore.getState().gate(5000 + 1000)).toEqual({ blocked: true, reason: '모드 전환 직후' });
    expect(useModeStore.getState().gate(5000 + MODE_SWITCH_COOLDOWN_MS)).toEqual({ blocked: false });
  });
});

describe('대기 / 해제', () => {
  it('standby 는 어느 경로로든 들어갈 수 있고 previous 를 기억한다', () => {
    useModeStore.getState().setMode('meeting', 'ui', { now: 1 });
    expect(useModeStore.getState().standby('voice', { now: 2 })).toBe(true);
    expect(useModeStore.getState().current).toBe('standby');
    expect(useModeStore.getState().previous).toBe('meeting');
  });

  it('wake 는 voice/ui/key 만 허용하고 previous 로 복귀', () => {
    useModeStore.getState().setMode('meeting', 'ui', { now: 1 });
    useModeStore.getState().standby('key', { now: 2 });
    expect(useModeStore.getState().wake('init', { now: 3 })).toBe(false);
    expect(useModeStore.getState().current).toBe('standby');
    expect(useModeStore.getState().wake('voice', { now: 4 })).toBe(true);
    expect(useModeStore.getState().current).toBe('meeting');
    expect(useModeStore.getState().cooldownUntil).toBe(4 + MODE_SWITCH_COOLDOWN_MS);
  });

  it('previous 가 없으면 media 로 깨어난다', () => {
    useModeStore.setState({ current: 'standby', previous: null });
    expect(useModeStore.getState().wake('ui', { now: 1 })).toBe(true);
    expect(useModeStore.getState().current).toBe('media');
  });

  it('대기 중 setMode 도 WAKE_SOURCES 가 아니면 거부된다', () => {
    useModeStore.setState({ current: 'standby', previous: 'media' });
    expect(useModeStore.getState().setMode('presentation', 'init')).toBe(false);
    expect(useModeStore.getState().setMode('presentation', 'voice', { now: 1 })).toBe(true);
  });

  it('활성 상태에서 wake 는 아무것도 하지 않는다', () => {
    expect(useModeStore.getState().wake('voice')).toBe(false);
    expect(useModeStore.getState().current).toBe('media');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { gestureGate, MODE_SWITCH_COOLDOWN_MS, useModeStore } from '../modeStore';

beforeEach(() => {
  useModeStore.setState({ current: 'slide', previous: null, switchedAt: 0, cooldownUntil: 0, lastSwitch: null });
});

describe('setMode', () => {
  it('전환 시 previous 기록과 1.5초 쿨다운 부여', () => {
    const ok = useModeStore.getState().setMode('laser', 'gesture', { now: 10_000 });
    expect(ok).toBe(true);
    const s = useModeStore.getState();
    expect(s.current).toBe('laser');
    expect(s.previous).toBe('slide');
    expect(s.cooldownUntil).toBe(10_000 + MODE_SWITCH_COOLDOWN_MS);
    expect(s.lastSwitch).toMatchObject({ from: 'slide', to: 'laser', source: 'gesture' });
  });

  it('같은 모드로의 재설정은 false 이고 상태가 바뀌지 않는다', () => {
    expect(useModeStore.getState().setMode('slide', 'ui')).toBe(false);
    expect(useModeStore.getState().previous).toBeNull();
  });
});

describe('gestureGate / gate', () => {
  it('정상 상태는 막지 않는다', () => {
    expect(gestureGate('slide', 0, 1000)).toEqual({ blocked: false });
  });

  it('MOTION OFF(standby) 에서는 항상 막는다 (주먹 포함)', () => {
    expect(gestureGate('standby', 0, 1000)).toEqual({ blocked: true, reason: 'MOTION OFF' });
  });

  it('전환 직후 쿨다운 동안 막고, 지나면 푼다', () => {
    useModeStore.getState().setMode('cursor', 'key', { now: 5000 });
    expect(useModeStore.getState().gate(5000 + 1000)).toEqual({ blocked: true, reason: '모드 전환 직후' });
    expect(useModeStore.getState().gate(5000 + MODE_SWITCH_COOLDOWN_MS)).toEqual({ blocked: false });
  });
});

describe('MOTION OFF (standby) / 해제', () => {
  it('세션 기본값은 standby 다 (모션 기본 OFF, §19)', () => {
    // 스토어 생성 시 초기값. 테스트 beforeEach 가 덮어쓰므로 create 시점 값을 별도 확인
    expect(useModeStore.getInitialState().current).toBe('standby');
  });

  it('standby 는 어느 경로로든 들어갈 수 있고 previous 를 기억한다 (agent 긴급 정지 포함)', () => {
    useModeStore.getState().setMode('asset', 'ui', { now: 1 });
    expect(useModeStore.getState().standby('agent', { now: 2 })).toBe(true);
    expect(useModeStore.getState().current).toBe('standby');
    expect(useModeStore.getState().previous).toBe('asset');
  });

  it('wake 는 voice/ui/key/gesture 만 허용하고 previous 로 복귀', () => {
    useModeStore.getState().setMode('asset', 'ui', { now: 1 });
    useModeStore.getState().standby('key', { now: 2 });
    expect(useModeStore.getState().wake('init', { now: 3 })).toBe(false);
    expect(useModeStore.getState().wake('agent', { now: 3 })).toBe(false);
    expect(useModeStore.getState().current).toBe('standby');
    expect(useModeStore.getState().wake('gesture', { now: 4 })).toBe(true);
    expect(useModeStore.getState().current).toBe('asset');
    expect(useModeStore.getState().cooldownUntil).toBe(4 + MODE_SWITCH_COOLDOWN_MS);
  });

  it('previous 가 없으면 slide 로 깨어난다', () => {
    useModeStore.setState({ current: 'standby', previous: null });
    expect(useModeStore.getState().wake('ui', { now: 1 })).toBe(true);
    expect(useModeStore.getState().current).toBe('slide');
  });

  it('standby 중 setMode 도 WAKE_SOURCES 가 아니면 거부된다', () => {
    useModeStore.setState({ current: 'standby', previous: 'slide' });
    expect(useModeStore.getState().setMode('laser', 'init')).toBe(false);
    expect(useModeStore.getState().setMode('laser', 'gesture', { now: 1 })).toBe(true);
  });

  it('toggleStandby: 켜져 있으면 끄고, 꺼져 있으면 이전 모드로 켠다 (양손 X 경로)', () => {
    useModeStore.getState().setMode('cursor', 'ui', { now: 1 });
    expect(useModeStore.getState().toggleStandby('gesture', { now: 2 })).toBe(true);
    expect(useModeStore.getState().current).toBe('standby');
    expect(useModeStore.getState().toggleStandby('gesture', { now: 3 })).toBe(true);
    expect(useModeStore.getState().current).toBe('cursor');
  });

  it('활성 상태에서 wake 는 아무것도 하지 않는다', () => {
    expect(useModeStore.getState().wake('voice')).toBe(false);
    expect(useModeStore.getState().current).toBe('slide');
  });
});

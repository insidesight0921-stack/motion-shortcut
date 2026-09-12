import { beforeEach, describe, expect, it } from 'vitest';
import { useModeStore } from '../../store/modeStore';
import { endPresentation, presentationControls, startPresentation } from '../presentation';

beforeEach(() => {
  useModeStore.setState({ current: 'standby', previous: null, switchedAt: 0, cooldownUntil: 0, lastSwitch: null });
});

describe('presentationControls', () => {
  it('카메라 꺼짐: 카메라 시작이 primary, 발표 시작은 disabled', () => {
    expect(presentationControls(false, 'standby')).toEqual({ primary: 'camera', startEnabled: false, presenting: false, startLabel: '발표 시작' });
  });

  it('카메라 켜짐 + MOTION OFF: 발표 시작이 primary', () => {
    expect(presentationControls(true, 'standby')).toEqual({ primary: 'start', startEnabled: true, presenting: false, startLabel: '발표 시작' });
  });

  it('발표 중: primary 없음, 발표 종료 버튼', () => {
    for (const m of ['slide', 'cursor', 'laser', 'asset'] as const) {
      expect(presentationControls(true, m)).toEqual({ primary: null, startEnabled: true, presenting: true, startLabel: '발표 종료' });
    }
  });

  it('한 시점에 primary 는 최대 하나', () => {
    for (const cam of [true, false]) for (const m of ['standby', 'slide'] as const) expect([null, 'camera', 'start']).toContain(presentationControls(cam, m).primary);
  });
});

describe('startPresentation / endPresentation', () => {
  it('발표 시작 = wake("ui"): standby → slide, 이전 모드가 있으면 그 모드', () => {
    expect(startPresentation()).toBe(true);
    expect(useModeStore.getState().current).toBe('slide');
    expect(useModeStore.getState().lastSwitch?.source).toBe('ui');
    useModeStore.getState().setMode('laser', 'ui', { now: 5 });
    expect(endPresentation()).toBe(true);
    expect(useModeStore.getState().current).toBe('standby');
    expect(startPresentation()).toBe(true);
    expect(useModeStore.getState().current).toBe('laser');
  });

  it('이미 발표 중이면 시작은 false, 이미 꺼져 있으면 종료는 false', () => {
    expect(endPresentation()).toBe(false);
    startPresentation();
    expect(startPresentation()).toBe(false);
  });
});

import type { GestureConfig } from './config';

/**
 * 양손 시퀀스 상태 머신 (추가 모듈). 순수 함수, 시간은 인자.
 *
 * 1차: stepMotionToggle — 양손 X 를 xHoldMs 유지하면 토글 1회. 놓기(release) 전에는 다시 토글되지 않는다.
 * 2차: 진입(검지 교차 유지) → 방향 선택 시퀀스가 여기 추가된다.
 */
export type MotionTogglePhase = 'idle' | 'holding' | 'cooldown';

export interface MotionToggleState {
  phase: MotionTogglePhase;
  start: number;
  lastSeen: number;
  progress: number;
  /** 마지막 토글 이후 X 를 한 번 풀었는가 */
  released: boolean;
  cooldownUntil: number;
}

export function createMotionToggleState(): MotionToggleState {
  return { phase: 'idle', start: 0, lastSeen: 0, progress: 0, released: true, cooldownUntil: 0 };
}

export interface MotionToggleObs {
  t: number;
  /** 이번 프레임에 양손 X 가 (점수 기준을 넘겨) 관측됐는가 */
  active: boolean;
}

export interface MotionToggleStep {
  state: MotionToggleState;
  /** 이번 틱에 토글이 일어났는가 */
  toggled: boolean;
}

export function stepMotionToggle(prev: MotionToggleState, obs: MotionToggleObs, cfg: GestureConfig): MotionToggleStep {
  const s: MotionToggleState = { ...prev };
  const t = obs.t;
  let toggled = false;

  if (!obs.active) s.released = true;

  if (s.phase === 'cooldown') {
    if (t >= s.cooldownUntil) {
      s.phase = 'idle';
      s.progress = 0;
    } else {
      return { state: s, toggled: false };
    }
  }

  if (s.phase === 'idle') {
    if (obs.active && s.released) {
      s.phase = 'holding';
      s.start = t;
      s.lastSeen = t;
      s.progress = 0;
    }
    return { state: s, toggled: false };
  }

  // holding
  if (obs.active) {
    s.lastSeen = t;
    s.progress = Math.min(1, (t - s.start) / cfg.xHoldMs);
    if (t - s.start >= cfg.xHoldMs) {
      toggled = true;
      s.phase = 'cooldown';
      s.cooldownUntil = t + cfg.cooldownMs;
      s.released = false;
      s.progress = 1;
    }
  } else if (t - s.lastSeen > cfg.holdGraceMs) {
    s.phase = 'idle';
    s.progress = 0;
  }
  return { state: s, toggled };
}

import type { GestureConfig } from './config';
import { isStaticGesture, type DynamicResult, type GestureId, type StaticPose } from './types';

/**
 * 오작동 방지 상태 머신 (기획서 7단계).
 *
 *   1 후보 발견        idle → holding(정적) / armed(동적)
 *   2 유지·궤적 확인   holding에서 유지 시간 누적 / 동적은 dynamic.ts가 궤적 조건을 이미 확인
 *   3 신뢰도 확인      매 틱 handScore ≥ minHandScore, poseScore ≥ minPoseScore (미달 → ignored:low_confidence)
 *   4 재실행 방지      cooldown 중 같은 제스처가 보이면 쿨다운 연장, 정적 제스처는 release 전 재무장 불가
 *   5 실행 예정 표시   armed (armDurationMs 동안)
 *   6 실행             executed 이벤트 (UI가 이펙트·효과음·명령 실행)
 *   7 쿨다운           cooldown (cooldownMs)
 *
 * 순수 함수다. 시간은 obs.t로 받고, 브라우저 API를 쓰지 않는다.
 * fist(활성화 토글)는 enabled와 무관하게 항상 처리한다. 나머지는 enabled=false면 ignored:disabled.
 */
export type Phase = 'idle' | 'holding' | 'armed' | 'cooldown';

export type IgnoreReason =
  | 'hold_too_short'
  | 'hand_lost'
  | 'moving'
  | 'cooldown'
  | 'disabled'
  | 'low_confidence'
  | 'needs_release';

export const IGNORE_REASON_LABEL: Record<IgnoreReason, string> = {
  hold_too_short: '유지 시간 부족',
  hand_lost: '손 사라짐',
  moving: '손이 움직임',
  cooldown: '쿨다운 중',
  disabled: '비활성화 상태',
  low_confidence: '신뢰도 부족',
  needs_release: '포즈를 풀지 않음',
};

export interface Observation {
  t: number;
  /** 손이 있으면 HandLandmarker 신뢰도(0~1), 없으면 null */
  handScore: number | null;
  /** 정적 포즈 판정 (손이 없으면 null) */
  staticPose: { pose: StaticPose | null; score: number } | null;
  /** 동적 제스처 판정 */
  dynamic: DynamicResult | null;
  /** 최근 motionWindowMs 동안 손목 속도 (손 크기/초) */
  motion: number;
  /** 모션 단축키 활성화 여부 */
  enabled: boolean;
}

export type GestureEventType = 'candidate' | 'progress' | 'armed' | 'executed' | 'cancelled' | 'ignored';

export interface GestureEvent {
  t: number;
  type: GestureEventType;
  gesture: GestureId;
  /** holding 진행률 0~1 */
  progress?: number;
  score?: number;
  reason?: IgnoreReason;
}

export interface MachineState {
  phase: Phase;
  candidate: GestureId | null;
  holdStart: number;
  lastSeen: number;
  progress: number;
  armedAt: number;
  cooldownUntil: number;
  lastExecuted: GestureId | null;
  lastExecutedAt: number;
  /** 정적 제스처 실행 후 포즈를 한 번 풀었는가. 풀기 전엔 같은 포즈로 재무장 불가 */
  releasedSinceExec: boolean;
  /** ignored 로그 중복 방지 키 (정적/동적 따로). 후보가 사라지면 초기화 */
  ignoredStaticKey: string | null;
  ignoredDynamicKey: string | null;
}

export function createInitialState(): MachineState {
  return {
    phase: 'idle',
    candidate: null,
    holdStart: 0,
    lastSeen: 0,
    progress: 0,
    armedAt: 0,
    cooldownUntil: 0,
    lastExecuted: null,
    lastExecutedAt: -Infinity,
    releasedSinceExec: true,
    ignoredStaticKey: null,
    ignoredDynamicKey: null,
  };
}

export interface StepResult {
  state: MachineState;
  events: GestureEvent[];
  /** 이번 틱에 실행된 제스처. 호출자는 이때 TrajectoryBuffer.clear()를 해야 한다 (D-008) */
  executed: GestureId | null;
}

export function holdMsFor(pose: StaticPose, cfg: GestureConfig): number {
  return pose === 'fist' ? cfg.fistHoldMs : cfg.palmHoldMs;
}

export function step(prev: MachineState, obs: Observation, cfg: GestureConfig): StepResult {
  const s: MachineState = { ...prev };
  const events: GestureEvent[] = [];
  let executed: GestureId | null = null;
  const t = obs.t;

  const ignore = (gesture: GestureId, reason: IgnoreReason, extra: Partial<GestureEvent> = {}) => {
    const key = `${gesture}:${reason}`;
    if (isStaticGesture(gesture)) {
      if (s.ignoredStaticKey === key) return;
      s.ignoredStaticKey = key;
    } else {
      if (s.ignoredDynamicKey === key) return;
      s.ignoredDynamicKey = key;
    }
    events.push({ t, type: 'ignored', gesture, reason, ...extra });
  };

  const rawPose = obs.staticPose?.pose ?? null;
  const poseScore = obs.staticPose?.score ?? 0;
  const handOk = obs.handScore !== null && obs.handScore >= cfg.minHandScore;
  const allowed = (g: GestureId) => obs.enabled || g === 'fist';

  // 후보가 사라지면 중복 방지 키를 풀어서 다음 등장 때 다시 로그가 남게 한다
  if (rawPose === null) s.ignoredStaticKey = null;
  if (obs.dynamic === null) s.ignoredDynamicKey = null;

  // release 추적: 마지막으로 실행한 정적 포즈가 아닌 상태가 한 번이라도 관측되면 풀린 것
  if (s.lastExecuted && isStaticGesture(s.lastExecuted) && !s.releasedSinceExec && rawPose !== s.lastExecuted) {
    s.releasedSinceExec = true;
  }

  // 3 신뢰도 확인
  let staticCand: StaticPose | null = null;
  if (rawPose) {
    if (!handOk || poseScore < cfg.minPoseScore) ignore(rawPose, 'low_confidence', { score: poseScore });
    else staticCand = rawPose;
  }
  let dynCand: DynamicResult | null = null;
  if (obs.dynamic) {
    if (!handOk || obs.dynamic.score < cfg.minDynamicScore) ignore(obs.dynamic.gesture, 'low_confidence', { score: obs.dynamic.score });
    else dynCand = obs.dynamic;
  }

  // 7 쿨다운 (+ 4 같은 제스처면 연장)
  if (s.phase === 'cooldown') {
    const seenRaw: GestureId | null = obs.dynamic?.gesture ?? rawPose;
    if (seenRaw && seenRaw === s.lastExecuted) {
      s.cooldownUntil = Math.max(s.cooldownUntil, t + cfg.cooldownMs);
    }
    if (t >= s.cooldownUntil) {
      s.phase = 'idle';
      s.candidate = null;
    } else {
      const seen = dynCand?.gesture ?? staticCand;
      if (seen) ignore(seen, 'cooldown');
      return { state: s, events, executed };
    }
  }

  // 4 release 전 재무장 금지
  if (staticCand && s.lastExecuted === staticCand && !s.releasedSinceExec) {
    ignore(staticCand, 'needs_release');
    staticCand = null;
  }

  const startHolding = (pose: StaticPose) => {
    s.phase = 'holding';
    s.candidate = pose;
    s.holdStart = t;
    s.lastSeen = t;
    s.progress = 0;
    events.push({ t, type: 'candidate', gesture: pose, score: poseScore });
  };

  // 1 동적 후보는 유지 중이던 정적 후보보다 우선한다 (손바닥을 든 채 스와이프하는 경우)
  if ((s.phase === 'idle' || s.phase === 'holding') && dynCand) {
    if (allowed(dynCand.gesture)) {
      if (s.phase === 'holding' && s.candidate) events.push({ t, type: 'cancelled', gesture: s.candidate });
      s.phase = 'armed';
      s.candidate = dynCand.gesture;
      s.armedAt = t;
      s.progress = 1;
      events.push({ t, type: 'candidate', gesture: dynCand.gesture, score: dynCand.score });
      events.push({ t, type: 'armed', gesture: dynCand.gesture });
    } else {
      ignore(dynCand.gesture, 'disabled');
    }
  }

  if (s.phase === 'idle') {
    if (staticCand) {
      if (allowed(staticCand)) startHolding(staticCand);
      else ignore(staticCand, 'disabled');
    }
  } else if (s.phase === 'holding') {
    // 2 유지 시간 확인
    const pose = s.candidate as StaticPose;
    const holdMs = holdMsFor(pose, cfg);
    const stillHere = staticCand === pose;
    const moving = obs.motion > cfg.holdMaxSpeed;
    if (stillHere && !moving) {
      s.lastSeen = t;
      s.progress = Math.min(1, (t - s.holdStart) / holdMs);
      events.push({ t, type: 'progress', gesture: pose, progress: s.progress });
      if (t - s.holdStart >= holdMs) {
        s.phase = 'armed';
        s.armedAt = t;
        events.push({ t, type: 'armed', gesture: pose });
      }
    } else if (t - s.lastSeen <= cfg.holdGraceMs) {
      // 잠깐의 끊김은 유예
    } else {
      const reason: IgnoreReason = obs.handScore === null ? 'hand_lost' : stillHere && moving ? 'moving' : 'hold_too_short';
      events.push({ t, type: 'ignored', gesture: pose, reason, progress: s.progress });
      s.phase = 'idle';
      s.candidate = null;
      s.progress = 0;
      // 다른 포즈로 바뀐 것이면 바로 그 포즈의 유지를 시작한다
      if (staticCand && staticCand !== pose && allowed(staticCand)) startHolding(staticCand);
    }
  }

  // 5 실행 예정 → 6 실행
  if (s.phase === 'armed' && s.candidate) {
    if (t - s.armedAt >= cfg.armDurationMs) {
      const g = s.candidate;
      events.push({ t, type: 'executed', gesture: g });
      executed = g;
      s.lastExecuted = g;
      s.lastExecutedAt = t;
      s.releasedSinceExec = !isStaticGesture(g);
      s.cooldownUntil = t + cfg.cooldownMs;
      s.phase = 'cooldown';
      s.candidate = null;
      s.progress = 0;
      s.ignoredStaticKey = null;
      s.ignoredDynamicKey = null;
    }
  }

  return { state: s, events, executed };
}

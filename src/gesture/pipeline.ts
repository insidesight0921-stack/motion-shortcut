import type { GestureConfig } from './config';
import { dist, handScale, normalizeHand } from './normalize';
import { classifyStaticPose, type StaticPoseResult } from './static';
import { createInitialState, step, type GestureEvent, type MachineState, type Observation, type Phase } from './stateMachine';
import { TrajectoryBuffer } from './trajectory';
import { LM, type DynamicResult, type GestureId, type HandFrame } from './types';

/** HUD가 표시하는 스냅샷 */
export interface HudState {
  phase: Phase;
  candidate: GestureId | null;
  progress: number;
  cooldownRemainingMs: number;
  lastExecuted: GestureId | null;
  lastExecutedAt: number;
  handScore: number | null;
  staticPose: StaticPoseResult | null;
  dynamic: DynamicResult | null;
  /** 손목 속도 (손 크기/초) */
  motion: number;
}

export interface PipelineOutput {
  t: number;
  hud: HudState;
  events: GestureEvent[];
  executed: GestureId | null;
}

/** 동적 제스처 검출기 시그니처. 6단계에서 dynamic.ts가 구현한다. */
export type DynamicDetector = (frames: HandFrame[], now: number, cfg: GestureConfig) => DynamicResult | null;

export interface PipelineDeps {
  getConfig: () => GestureConfig;
  getEnabled: () => boolean;
  detectDynamic?: DynamicDetector;
}

/**
 * 프레임 → 제스처 이벤트 파이프라인. 상태(머신 상태, 궤적 버퍼)를 갖지만 브라우저 API는 쓰지 않는다.
 * 매 틱 process()를 호출한다. 손이 없으면 frame=null로 호출해야 유지·쿨다운 시간이 흐른다.
 */
export class GesturePipeline {
  private state: MachineState = createInitialState();
  readonly trajectory: TrajectoryBuffer;

  constructor(private deps: PipelineDeps) {
    this.trajectory = new TrajectoryBuffer(deps.getConfig().trajectoryMs);
  }

  get machineState(): MachineState {
    return this.state;
  }

  reset(): void {
    this.state = createInitialState();
    this.trajectory.clear();
  }

  process(frame: HandFrame | null, t: number): PipelineOutput {
    const cfg = this.deps.getConfig();
    this.trajectory.setMaxAge(cfg.trajectoryMs);

    let staticPose: StaticPoseResult | null = null;
    let dynamic: DynamicResult | null = null;
    let motion = 0;

    if (frame) {
      this.trajectory.push(frame);
      staticPose = classifyStaticPose(normalizeHand(frame.landmarks).points, cfg);
      motion = this.wristSpeed(cfg, t);
      if (this.deps.detectDynamic) {
        dynamic = this.deps.detectDynamic(this.trajectory.window(cfg.trajectoryMs, t), t, cfg);
      }
    }

    const obs: Observation = {
      t,
      handScore: frame ? frame.score : null,
      staticPose: staticPose ? { pose: staticPose.pose, score: staticPose.score } : null,
      dynamic,
      motion,
      enabled: this.deps.getEnabled(),
    };

    const result = step(this.state, obs, cfg);
    this.state = result.state;

    // D-008: 실행 → 쿨다운 전이에서 궤적을 비운다. 남은 궤적이 같은 제스처로 재검출되는 것을 막는다.
    if (result.executed) this.trajectory.clear();

    return {
      t,
      hud: {
        phase: this.state.phase,
        candidate: this.state.candidate,
        progress: this.state.progress,
        cooldownRemainingMs: this.state.phase === 'cooldown' ? Math.max(0, this.state.cooldownUntil - t) : 0,
        lastExecuted: this.state.lastExecuted,
        lastExecutedAt: this.state.lastExecutedAt,
        handScore: obs.handScore,
        staticPose,
        dynamic,
        motion,
      },
      events: result.events,
      executed: result.executed,
    };
  }

  /** 최근 motionWindowMs 동안 손목 이동 속도 (손 크기/초) */
  private wristSpeed(cfg: GestureConfig, now: number): number {
    const win = this.trajectory.window(cfg.motionWindowMs, now);
    if (win.length < 2) return 0;
    const a = win[0];
    const b = win[win.length - 1];
    const dtSec = (b.t - a.t) / 1000;
    if (dtSec <= 0) return 0;
    const scale = handScale(b.landmarks);
    if (scale < 1e-6) return 0;
    return dist(a.landmarks[LM.WRIST], b.landmarks[LM.WRIST]) / scale / dtSec;
  }
}

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type GestureConfig } from '../config';
import { createInitialState, step, type GestureEvent, type MachineState, type Observation } from '../stateMachine';
import type { DynamicResult, StaticPose } from '../types';

const cfg: GestureConfig = { ...DEFAULT_CONFIG };
const FPS_MS = 33;

interface ObsOpts {
  pose?: StaticPose | null;
  score?: number;
  handScore?: number | null;
  dynamic?: DynamicResult | null;
  motion?: number;
  enabled?: boolean;
}

function obs(t: number, o: ObsOpts = {}): Observation {
  const hand = o.handScore === undefined ? 0.9 : o.handScore;
  const noHand = hand === null;
  return {
    t,
    handScore: hand,
    staticPose: noHand ? null : { pose: o.pose ?? null, score: o.score ?? 0.9 },
    dynamic: o.dynamic ?? null,
    motion: o.motion ?? 0,
    enabled: o.enabled ?? true,
  };
}

/** t0부터 durationMs 동안 FPS_MS 간격으로 같은 관측을 넣는다. 마지막 상태와 모든 이벤트를 돌려준다. */
function run(state: MachineState, t0: number, durationMs: number, o: ObsOpts, c = cfg) {
  const events: GestureEvent[] = [];
  const executed: string[] = [];
  let s = state;
  let t = t0;
  for (; t <= t0 + durationMs; t += FPS_MS) {
    const r = step(s, obs(t, o), c);
    s = r.state;
    events.push(...r.events);
    if (r.executed) executed.push(r.executed);
  }
  return { state: s, events, executed, tEnd: t - FPS_MS };
}

const types = (events: GestureEvent[]) => events.map((e) => e.type);
const ignoredReasons = (events: GestureEvent[]) => events.filter((e) => e.type === 'ignored').map((e) => e.reason);

const swipeRight: DynamicResult = { gesture: 'swipe_right', score: 0.9, detail: {} };

describe('정적 포즈 유지', () => {
  it('손바닥 0.5초 유지 → 후보→진행→실행 예정→실행 순서로 한 번 실행', () => {
    const r = run(createInitialState(), 0, 1000, { pose: 'open_palm' });
    expect(r.executed).toEqual(['open_palm']);
    const ts = types(r.events);
    expect(ts[0]).toBe('candidate');
    expect(ts.indexOf('armed')).toBeGreaterThan(ts.indexOf('progress'));
    expect(ts.indexOf('executed')).toBeGreaterThan(ts.indexOf('armed'));
    const exec = r.events.find((e) => e.type === 'executed')!;
    expect(exec.t).toBeGreaterThanOrEqual(cfg.palmHoldMs + cfg.armDurationMs);
  });

  it('주먹은 2초를 채워야 실행된다', () => {
    const short = run(createInitialState(), 0, 1500, { pose: 'fist' });
    expect(short.executed).toEqual([]);
    const long = run(createInitialState(), 0, 2500, { pose: 'fist' });
    expect(long.executed).toEqual(['fist']);
  });

  it('유지 시간 부족으로 포즈가 사라지면 ignored:hold_too_short, 실행 없음', () => {
    const a = run(createInitialState(), 0, 300, { pose: 'open_palm' });
    const b = run(a.state, a.tEnd + FPS_MS, 500, { pose: null });
    expect([...a.executed, ...b.executed]).toEqual([]);
    expect(ignoredReasons(b.events)).toContain('hold_too_short');
  });

  it('손 자체가 사라지면 ignored:hand_lost', () => {
    const a = run(createInitialState(), 0, 300, { pose: 'open_palm' });
    const b = run(a.state, a.tEnd + FPS_MS, 500, { handScore: null });
    expect(ignoredReasons(b.events)).toContain('hand_lost');
  });

  it('유예 시간(150ms) 안의 끊김은 유지를 리셋하지 않는다', () => {
    const a = run(createInitialState(), 0, 300, { pose: 'open_palm' });
    const gap = run(a.state, a.tEnd + FPS_MS, 100, { pose: null }); // 약 100ms 끊김
    expect(ignoredReasons(gap.events)).toEqual([]);
    const c = run(gap.state, gap.tEnd + FPS_MS, 300, { pose: 'open_palm' });
    expect(c.executed).toEqual(['open_palm']);
  });

  it('유예 시간을 넘는 끊김은 유지를 리셋한다', () => {
    const a = run(createInitialState(), 0, 300, { pose: 'open_palm' });
    const gap = run(a.state, a.tEnd + FPS_MS, 300, { pose: null });
    expect(ignoredReasons(gap.events)).toContain('hold_too_short');
    const c = run(gap.state, gap.tEnd + FPS_MS, 300, { pose: 'open_palm' });
    expect(c.executed).toEqual([]); // 300ms로는 부족 → 처음부터 다시 센 것
  });

  it('손이 빠르게 움직이는 동안은 유지 시간이 쌓이지 않는다 (ignored:moving)', () => {
    const r = run(createInitialState(), 0, 1000, { pose: 'open_palm', motion: cfg.holdMaxSpeed * 2 });
    expect(r.executed).toEqual([]);
    expect(ignoredReasons(r.events)).toContain('moving');
  });
});

describe('신뢰도', () => {
  it('포즈 점수가 낮으면 ignored:low_confidence, 유지 시작 안 함', () => {
    const r = run(createInitialState(), 0, 1000, { pose: 'open_palm', score: 0.3 });
    expect(r.executed).toEqual([]);
    expect(ignoredReasons(r.events)).toEqual(['low_confidence']); // 에피소드당 한 번만
  });

  it('손 신뢰도가 낮아도 마찬가지', () => {
    const r = run(createInitialState(), 0, 1000, { pose: 'open_palm', handScore: 0.2 });
    expect(r.executed).toEqual([]);
    expect(ignoredReasons(r.events)).toContain('low_confidence');
  });
});

describe('활성화 on/off', () => {
  it('비활성 상태에서 손바닥은 ignored:disabled (에피소드당 한 번)', () => {
    const r = run(createInitialState(), 0, 1000, { pose: 'open_palm', enabled: false });
    expect(r.executed).toEqual([]);
    expect(ignoredReasons(r.events)).toEqual(['disabled']);
  });

  it('비활성 상태에서도 주먹은 실행된다 (잠금 해제 경로)', () => {
    const r = run(createInitialState(), 0, 2500, { pose: 'fist', enabled: false });
    expect(r.executed).toEqual(['fist']);
  });

  it('비활성 상태에서 동적 제스처는 ignored:disabled', () => {
    const r = run(createInitialState(), 0, 300, { dynamic: swipeRight, enabled: false });
    expect(r.executed).toEqual([]);
    expect(ignoredReasons(r.events)).toEqual(['disabled']);
  });

  it('후보가 사라졌다 다시 나타나면 disabled 로그가 다시 남는다', () => {
    const a = run(createInitialState(), 0, 300, { pose: 'open_palm', enabled: false });
    const gap = run(a.state, a.tEnd + FPS_MS, 200, { pose: null, enabled: false });
    const b = run(gap.state, gap.tEnd + FPS_MS, 300, { pose: 'open_palm', enabled: false });
    expect(ignoredReasons([...a.events, ...b.events])).toEqual(['disabled', 'disabled']);
  });
});

describe('쿨다운과 재실행 방지', () => {
  it('실행 후 쿨다운 동안 다른 제스처는 ignored:cooldown', () => {
    const a = run(createInitialState(), 0, 800, { pose: 'open_palm' });
    expect(a.executed).toEqual(['open_palm']);
    const b = run(a.state, a.tEnd + FPS_MS, 500, { dynamic: swipeRight });
    expect(b.executed).toEqual([]);
    expect(ignoredReasons(b.events)).toContain('cooldown');
  });

  it('쿨다운이 끝나면 다른 제스처가 실행된다', () => {
    const a = run(createInitialState(), 0, 800, { pose: 'open_palm' });
    const idle = run(a.state, a.tEnd + FPS_MS, cfg.cooldownMs + 100, { pose: null });
    const b = run(idle.state, idle.tEnd + FPS_MS, 300, { dynamic: swipeRight });
    expect(b.executed).toEqual(['swipe_right']);
  });

  it('같은 제스처가 계속 보이면 쿨다운이 연장된다', () => {
    const a = run(createInitialState(), 0, 800, { pose: 'open_palm' });
    const execAt = a.state.lastExecutedAt;
    // 실행 후 3초 동안 손바닥을 계속 들고 있음 (기본 쿨다운 1.5초보다 김)
    const hold = run(a.state, a.tEnd + FPS_MS, 3000, { pose: 'open_palm' });
    expect(hold.executed).toEqual([]);
    expect(hold.state.phase).toBe('cooldown');
    expect(hold.state.cooldownUntil).toBeGreaterThan(execAt + cfg.cooldownMs);
    expect(hold.state.cooldownUntil).toBeGreaterThanOrEqual(hold.tEnd + cfg.cooldownMs - FPS_MS);
  });

  it('손바닥을 계속 들고 있으면 재실행되지 않고, 놓았다 다시 들면 실행된다', () => {
    const a = run(createInitialState(), 0, 800, { pose: 'open_palm' });
    const hold = run(a.state, a.tEnd + FPS_MS, 5000, { pose: 'open_palm' });
    expect(hold.executed).toEqual([]);
    const release = run(hold.state, hold.tEnd + FPS_MS, cfg.cooldownMs + 200, { pose: null });
    const again = run(release.state, release.tEnd + FPS_MS, 1000, { pose: 'open_palm' });
    expect(again.executed).toEqual(['open_palm']);
  });

  it('주먹 토글 후 release 없이는 재무장되지 않는다 (쿨다운이 지나도)', () => {
    const a = run(createInitialState(), 0, 2500, { pose: 'fist', enabled: false });
    expect(a.executed).toEqual(['fist']);
    // 쿨다운(1.5초)보다 훨씬 긴 6초 동안 주먹을 계속 쥐고 있음
    const keep = run(a.state, a.tEnd + FPS_MS, 6000, { pose: 'fist', enabled: true });
    expect(keep.executed).toEqual([]);
    // 손을 펴서(다른 포즈) release
    const release = run(keep.state, keep.tEnd + FPS_MS, cfg.cooldownMs + 200, { pose: null });
    const again = run(release.state, release.tEnd + FPS_MS, 2500, { pose: 'fist' });
    expect(again.executed).toEqual(['fist']);
  });

  it('쿨다운이 0이어도 release 전에는 재무장되지 않고 ignored:needs_release로 기록된다', () => {
    // 기본 설정에서는 같은 포즈가 쿨다운을 계속 연장하므로 needs_release까지 가지 않는다.
    // 개발 패널에서 쿨다운을 0으로 내려도 release 규칙이 마지막 방어선으로 남아 있어야 한다.
    const noCooldown = { ...cfg, cooldownMs: 0 };
    const a = run(createInitialState(), 0, 2500, { pose: 'fist' }, noCooldown);
    expect(a.executed).toEqual(['fist']);
    const keep = run(a.state, a.tEnd + FPS_MS, 3000, { pose: 'fist' }, noCooldown);
    expect(keep.executed).toEqual([]);
    // 실행 직후 틱부터 주먹을 계속 쥐고 있으므로 하나의 에피소드 → 로그는 정확히 한 번
    expect(ignoredReasons([...a.events, ...keep.events])).toEqual(['needs_release']);
    const release = run(keep.state, keep.tEnd + FPS_MS, 200, { pose: null }, noCooldown);
    const again = run(release.state, release.tEnd + FPS_MS, 2500, { pose: 'fist' }, noCooldown);
    expect(again.executed).toEqual(['fist']);
  });

  it('다른 포즈로 바뀌면 release되어 정상 재무장된다', () => {
    const a = run(createInitialState(), 0, 2500, { pose: 'fist' });
    const during = run(a.state, a.tEnd + FPS_MS, cfg.cooldownMs + 100, { pose: 'open_palm' });
    const again = run(during.state, during.tEnd + FPS_MS, 2500, { pose: 'fist' });
    expect(again.executed).toEqual(['fist']);
  });
});

describe('동적 제스처', () => {
  it('동적 후보는 armDurationMs 뒤 실행된다', () => {
    const r = run(createInitialState(), 0, 500, { dynamic: swipeRight });
    expect(r.executed).toEqual(['swipe_right']);
    const exec = r.events.find((e) => e.type === 'executed')!;
    expect(exec.t).toBeGreaterThanOrEqual(cfg.armDurationMs);
  });

  it('armDurationMs=0이면 같은 틱에 실행된다', () => {
    const r = step(createInitialState(), obs(0, { dynamic: swipeRight }), { ...cfg, armDurationMs: 0 });
    expect(r.executed).toBe('swipe_right');
  });

  it('손바닥 유지 중 스와이프가 들어오면 유지를 취소하고 스와이프를 실행한다', () => {
    const a = run(createInitialState(), 0, 200, { pose: 'open_palm' });
    const b = run(a.state, a.tEnd + FPS_MS, 500, { pose: 'open_palm', dynamic: swipeRight });
    expect(b.executed).toEqual(['swipe_right']);
    expect(types(b.events)).toContain('cancelled');
  });

  it('동적 제스처 실행 후에는 release 없이도 쿨다운만 지나면 재실행된다', () => {
    const a = run(createInitialState(), 0, 300, { dynamic: swipeRight });
    expect(a.executed).toEqual(['swipe_right']);
    const idle = run(a.state, a.tEnd + FPS_MS, cfg.cooldownMs + 100, {});
    const b = run(idle.state, idle.tEnd + FPS_MS, 300, { dynamic: swipeRight });
    expect(b.executed).toEqual(['swipe_right']);
  });
});

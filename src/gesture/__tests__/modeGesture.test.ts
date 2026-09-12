import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { createMotionToggleState, stepMotionToggle, type MotionToggleState } from '../modeGesture';

const cfg = DEFAULT_CONFIG;
const FPS_MS = 33;

function run(state: MotionToggleState, t0: number, durationMs: number, active: boolean) {
  let s = state;
  let toggles = 0;
  let t = t0;
  for (; t <= t0 + durationMs; t += FPS_MS) {
    const r = stepMotionToggle(s, { t, active }, cfg);
    s = r.state;
    if (r.toggled) toggles++;
  }
  return { state: s, toggles, tEnd: t - FPS_MS };
}

describe('stepMotionToggle (양손 X → MOTION OFF 토글)', () => {
  it('xHoldMs 유지 시 정확히 한 번 토글되고 진행률이 올라간다', () => {
    const a = run(createMotionToggleState(), 0, 500, true);
    expect(a.toggles).toBe(0);
    expect(a.state.phase).toBe('holding');
    expect(a.state.progress).toBeGreaterThan(0.4);
    const b = run(a.state, a.tEnd + FPS_MS, 800, true);
    expect(b.toggles).toBe(1);
  });

  it('계속 유지해도 다시 토글되지 않는다 (release 규칙)', () => {
    const a = run(createMotionToggleState(), 0, 1200, true);
    expect(a.toggles).toBe(1);
    const hold = run(a.state, a.tEnd + FPS_MS, 5000, true);
    expect(hold.toggles).toBe(0);
  });

  it('놓았다가 다시 유지하면 다시 토글된다', () => {
    const a = run(createMotionToggleState(), 0, 1200, true);
    const rel = run(a.state, a.tEnd + FPS_MS, cfg.cooldownMs + 200, false);
    expect(rel.toggles).toBe(0);
    const again = run(rel.state, rel.tEnd + FPS_MS, 1200, true);
    expect(again.toggles).toBe(1);
  });

  it('유예(holdGraceMs) 안의 끊김은 유지를 리셋하지 않는다', () => {
    const a = run(createMotionToggleState(), 0, 500, true);
    const gap = run(a.state, a.tEnd + FPS_MS, cfg.holdGraceMs - 100, false);
    expect(gap.state.phase).toBe('holding');
    const b = run(gap.state, gap.tEnd + FPS_MS, 600, true);
    expect(b.toggles).toBe(1);
  });

  it('유예를 넘는 끊김은 처음부터 다시 센다', () => {
    const a = run(createMotionToggleState(), 0, 700, true);
    const gap = run(a.state, a.tEnd + FPS_MS, cfg.holdGraceMs + 200, false);
    expect(gap.state.phase).toBe('idle');
    const b = run(gap.state, gap.tEnd + FPS_MS, 700, true);
    expect(b.toggles).toBe(0); // 700ms 로는 부족
  });

  it('토글 직후 쿨다운 동안은 새 유지가 시작되지 않는다', () => {
    const a = run(createMotionToggleState(), 0, 1200, true);
    const rel = run(a.state, a.tEnd + FPS_MS, 100, false);
    const during = run(rel.state, rel.tEnd + FPS_MS, 300, true); // 쿨다운(1500ms) 안
    expect(during.state.phase).toBe('cooldown');
  });
});

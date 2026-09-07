import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { GesturePipeline } from '../pipeline';
import type { DynamicResult, HandFrame, Point } from '../types';
import { fistHand, openHand, translateHand } from './fixtures';

const FPS_MS = 33;

function makePipeline(opts: { enabled?: boolean; detectDynamic?: DynamicResult | null } = {}) {
  const enabled = { value: opts.enabled ?? true };
  const pipeline = new GesturePipeline({
    getConfig: () => DEFAULT_CONFIG,
    getEnabled: () => enabled.value,
    detectDynamic: opts.detectDynamic === undefined ? undefined : () => opts.detectDynamic ?? null,
  });
  return { pipeline, enabled };
}

/** 같은 손 모양을 durationMs 동안 30fps로 넣는다. 실행된 제스처 목록을 돌려준다. */
function feed(pipeline: GesturePipeline, hand: Point[] | null, t0: number, durationMs: number, mover?: (i: number) => Point[]) {
  const executed: { gesture: string; t: number }[] = [];
  let t = t0;
  let i = 0;
  for (; t <= t0 + durationMs; t += FPS_MS, i++) {
    const lm = mover ? mover(i) : hand;
    const frame: HandFrame | null = lm ? { t, landmarks: lm, score: 0.95 } : null;
    const out = pipeline.process(frame, t);
    if (out.executed) executed.push({ gesture: out.executed, t });
  }
  return { executed, tEnd: t - FPS_MS };
}

describe('GesturePipeline', () => {
  it('손바닥 프레임을 0.6초 넣으면 open_palm이 한 번 실행된다', () => {
    const { pipeline } = makePipeline();
    const r = feed(pipeline, openHand(), 0, 1000);
    expect(r.executed.map((e) => e.gesture)).toEqual(['open_palm']);
  });

  it('비활성 상태에서도 주먹 2초면 fist가 실행된다', () => {
    const { pipeline } = makePipeline({ enabled: false });
    const r = feed(pipeline, fistHand(), 0, 2500);
    expect(r.executed.map((e) => e.gesture)).toEqual(['fist']);
  });

  it('실행 직후 궤적 버퍼가 비워진다 (D-008)', () => {
    const { pipeline } = makePipeline();
    const clearSpy = vi.spyOn(pipeline.trajectory, 'clear');
    let t = 0;
    let executedAt = -1;
    for (; t <= 1000; t += FPS_MS) {
      const before = pipeline.trajectory.length;
      const out = pipeline.process({ t, landmarks: openHand(), score: 0.95 }, t);
      if (out.executed) {
        executedAt = t;
        expect(before).toBeGreaterThan(0);
        expect(pipeline.trajectory.length).toBe(0);
        break;
      }
    }
    expect(executedAt).toBeGreaterThan(0);
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('실행되지 않은 틱에서는 궤적을 비우지 않는다', () => {
    const { pipeline } = makePipeline();
    const clearSpy = vi.spyOn(pipeline.trajectory, 'clear');
    feed(pipeline, openHand(), 0, 300); // 유지 시간 미달
    expect(clearSpy).not.toHaveBeenCalled();
    expect(pipeline.trajectory.length).toBeGreaterThan(0);
  });

  it('손바닥을 든 채 빠르게 움직이면 실행되지 않는다', () => {
    const { pipeline } = makePipeline();
    // 프레임당 손 크기(0.2)의 0.15배 = 4.5 손크기/초 이동
    const r = feed(pipeline, null, 0, 1000, (i) => translateHand(openHand(), ((i % 10) - 5) * 0.03, 0));
    expect(r.executed).toEqual([]);
  });

  it('HUD 스냅샷에 단계·후보·진행률이 담긴다', () => {
    const { pipeline } = makePipeline();
    const out = pipeline.process({ t: 0, landmarks: openHand(), score: 0.95 }, 0);
    expect(out.hud.phase).toBe('holding');
    expect(out.hud.candidate).toBe('open_palm');
    const later = pipeline.process({ t: 250, landmarks: openHand(), score: 0.95 }, 250);
    expect(later.hud.progress).toBeCloseTo(0.5, 1);
    expect(later.hud.staticPose?.pose).toBe('open_palm');
  });

  it('손이 없는 프레임(null)도 시간이 흘러 쿨다운이 끝난다', () => {
    const { pipeline } = makePipeline();
    const a = feed(pipeline, openHand(), 0, 800);
    expect(a.executed).toHaveLength(1);
    const b = feed(pipeline, null, a.tEnd + FPS_MS, DEFAULT_CONFIG.cooldownMs + 200);
    expect(pipeline.machineState.phase).toBe('idle');
    expect(b.executed).toEqual([]);
  });
});

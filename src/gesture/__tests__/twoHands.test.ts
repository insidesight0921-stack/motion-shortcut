import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { angleBetweenDeg, classifyTwoHandPose, pairHands, pickPrimaryHand, segmentsIntersect, twoHandCenter } from '../twoHands';
import type { HandFrame, Point } from '../types';
import { placeHands } from './fixtures';

const cfg = DEFAULT_CONFIG;
const frame = (landmarks: Point[], hand: 'left' | 'right' | undefined, t = 0): HandFrame => ({ t, landmarks, score: 0.9, hand });

/** X 자세: 손목 0.16(0.8 손 크기) 떨어진 두 손이 서로를 향해 35° 기울어 위에서 교차 */
function xPose(opts: { gap?: number; tilt?: number; spec?: 'open' | 'fist' | 'point' } = {}) {
  const gap = opts.gap ?? 0.16;
  const tilt = opts.tilt ?? 35;
  const spec = opts.spec === 'fist' ? { thumb: 'folded' as const, index: 'folded' as const, middle: 'folded' as const, ring: 'folded' as const, pinky: 'folded' as const } : opts.spec === 'point' ? { thumb: 'folded' as const, index: 'extended' as const, middle: 'folded' as const, ring: 'folded' as const, pinky: 'folded' as const } : undefined;
  const { left, right } = placeHands({ spec, wristAt: { x: 0.5 - gap / 2, y: 0.85 }, rotDeg: tilt }, { spec, wristAt: { x: 0.5 + gap / 2, y: 0.85 }, rotDeg: -tilt });
  return { left: frame(left, 'left'), right: frame(right, 'right') };
}

/** 나란히 선 두 손 (교차 없음) */
function parallelPose(gap = 0.3) {
  const { left, right } = placeHands({ wristAt: { x: 0.5 - gap / 2, y: 0.85 } }, { wristAt: { x: 0.5 + gap / 2, y: 0.85 } });
  return { left: frame(left, 'left'), right: frame(right, 'right') };
}

describe('기하 도우미', () => {
  it('segmentsIntersect: 교차하는 X 와 평행한 두 선분', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 })).toMatchObject({ hit: true });
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }).tOnFirst).toBeCloseTo(0.5);
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }).hit).toBe(false);
  });

  it('angleBetweenDeg', () => {
    expect(angleBetweenDeg({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
    expect(angleBetweenDeg({ x: 1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
    expect(angleBetweenDeg({ x: 1, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(180);
  });
});

describe('pairHands', () => {
  it('라벨이 있으면 라벨로, 없으면 손목 x 로 왼/오른을 정한다', () => {
    const p = parallelPose();
    const byLabel = pairHands([p.right, p.left])!;
    expect(byLabel.left).toBe(p.left);
    expect(byLabel.right).toBe(p.right);
    const noLabel = pairHands([frame(p.right.landmarks, undefined), frame(p.left.landmarks, undefined)])!;
    expect(noLabel.left.landmarks[0].x).toBeLessThan(noLabel.right.landmarks[0].x);
  });

  it('손이 2개가 아니면 null', () => {
    const p = parallelPose();
    expect(pairHands([p.left])).toBeNull();
    expect(pairHands([])).toBeNull();
  });

  it('twoHandCenter 는 두 손목의 중점', () => {
    const p = parallelPose(0.3);
    const c = twoHandCenter(pairHands([p.left, p.right])!);
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.85);
  });
});

describe('classifyTwoHandPose — x_cross (모션 잠금)', () => {
  it('서로를 향해 기울어 교차한 양손은 x_cross, 점수 ≥ 하한', () => {
    const p = xPose();
    const r = classifyTwoHandPose(pairHands([p.left, p.right])!, cfg);
    expect(r.pose).toBe('x_cross');
    expect(r.score).toBeGreaterThanOrEqual(cfg.twoHandMinScore);
    expect(r.detail.angleDeg).toBeGreaterThan(cfg.crossAngleMinDeg);
    expect(r.detail.angleDeg).toBeLessThan(cfg.crossAngleMaxDeg);
  });

  it('손가락 모양은 묻지 않는다: 주먹으로 만든 X 도 x_cross', () => {
    const p = xPose({ spec: 'fist' });
    expect(classifyTwoHandPose(pairHands([p.left, p.right])!, cfg).pose).toBe('x_cross');
  });

  it('나란히 선 두 손은 null', () => {
    const p = parallelPose();
    expect(classifyTwoHandPose(pairHands([p.left, p.right])!, cfg).pose).toBeNull();
  });

  it('기울기가 작아 교차하지 않으면 null', () => {
    const p = xPose({ tilt: 5 });
    expect(classifyTwoHandPose(pairHands([p.left, p.right])!, cfg).pose).toBeNull();
  });

  it('손목이 너무 멀면(crossMaxWristDistance 초과) null', () => {
    const p = xPose({ gap: 0.7, tilt: 60 });
    const r = classifyTwoHandPose(pairHands([p.left, p.right])!, cfg);
    expect(r.pose).toBeNull();
  });
});

describe('classifyTwoHandPose — index_cross (모드 진입, 2차 준비)', () => {
  it('양손 포인팅 + 검지 교차 → index_cross 가 x_cross 보다 우선', () => {
    // 검지는 손목에서 멀리 있으므로 손목 간격을 넓혀야 검지 선분끼리 만난다 (35°, 0.34 = 1.7 손 크기, 각도 70°)
    const p = xPose({ spec: 'point', gap: 0.34, tilt: 35 });
    const r = classifyTwoHandPose(pairHands([p.left, p.right])!, cfg);
    expect(r.pose).toBe('index_cross');
    expect(r.score).toBeGreaterThanOrEqual(cfg.twoHandMinScore);
  });

  it('한 손만 포인팅이면 index_cross 가 아니라 x_cross 판정으로 넘어간다', () => {
    const { left, right } = placeHands(
      { spec: { thumb: 'folded', index: 'extended', middle: 'folded', ring: 'folded', pinky: 'folded' }, wristAt: { x: 0.42, y: 0.85 }, rotDeg: 35 },
      { wristAt: { x: 0.58, y: 0.85 }, rotDeg: -35 },
    );
    const r = classifyTwoHandPose(pairHands([frame(left, 'left'), frame(right, 'right')])!, cfg);
    expect(r.pose).toBe('x_cross');
  });
});

describe('pickPrimaryHand', () => {
  it('설정된 손을 우선, 없으면 첫 손, 손이 없으면 null', () => {
    const p = parallelPose();
    expect(pickPrimaryHand([p.left, p.right], 'right')).toBe(p.right);
    expect(pickPrimaryHand([p.left, p.right], 'left')).toBe(p.left);
    expect(pickPrimaryHand([p.left], 'right')).toBe(p.left);
    expect(pickPrimaryHand([], 'right')).toBeNull();
  });
});

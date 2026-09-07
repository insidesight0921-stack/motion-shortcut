import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { absRotationDeg, detectCircle, detectDynamic, detectSwipe, signedRotationDeg } from '../dynamic';
import { LM, type HandFrame, type Point } from '../types';
import { openHand, pointingHand, translateHand } from './fixtures';

const cfg = DEFAULT_CONFIG;
const FPS_MS = 33;
const HAND = 0.2; // 픽스처 손 크기 (손목–중지MCP, 0~1 단위)

/** 프레임 i(0..n-1)마다 손 전체의 이동량 (dx, dy)을 돌려주는 함수로 궤적을 만든다 */
function motionFrames(n: number, offset: (i: number) => { dx: number; dy: number }, base: Point[] = openHand()): HandFrame[] {
  const frames: HandFrame[] = [];
  for (let i = 0; i < n; i++) {
    const { dx, dy } = offset(i);
    frames.push({ t: i * FPS_MS, landmarks: translateHand(base, dx, dy), score: 0.95 });
  }
  return frames;
}
const lastT = (frames: HandFrame[]) => frames[frames.length - 1].t;

/** 손 전체가 durationMs 동안 손 크기 handUnits 배만큼 등속 이동 */
function linear(durationMs: number, handUnitsX: number, handUnitsY = 0) {
  const n = Math.round(durationMs / FPS_MS) + 1;
  return motionFrames(n, (i) => ({ dx: (i / (n - 1)) * handUnitsX * HAND, dy: (i / (n - 1)) * handUnitsY * HAND }));
}

/** 검지 끝이 반지름 r(0~1 단위)인 원 위를 돌도록 손 전체를 이동. turns 바퀴, durationMs 동안 */
function circular(durationMs: number, r: number, turns: number, base: Point[] = pointingHand()) {
  const n = Math.round(durationMs / FPS_MS) + 1;
  return motionFrames(
    n,
    (i) => {
      const a = (i / (n - 1)) * turns * 2 * Math.PI;
      return { dx: r * Math.cos(a), dy: r * Math.sin(a) };
    },
    base,
  );
}

describe('detectSwipe', () => {
  it('사용자 오른쪽(x 증가)으로 2.5 손크기 이동 → swipe_right', () => {
    const frames = linear(400, 2.5);
    const r = detectSwipe(frames, lastT(frames), cfg);
    expect(r?.gesture).toBe('swipe_right');
    expect(r!.score).toBeGreaterThanOrEqual(cfg.minDynamicScore);
    expect(r!.detail.dx).toBeGreaterThan(0);
  });

  it('x 감소 방향 이동 → swipe_left', () => {
    const frames = linear(400, -2.5);
    expect(detectSwipe(frames, lastT(frames), cfg)?.gesture).toBe('swipe_left');
  });

  it('이동량이 부족하면 null', () => {
    const frames = linear(400, 1.2);
    expect(detectSwipe(frames, lastT(frames), cfg)).toBeNull();
  });

  it('느린 이동(창 안에서 이동량 부족)은 null', () => {
    const frames = linear(1500, 2.5); // 0.5초 창에는 약 0.83 손크기만 들어옴
    expect(detectSwipe(frames, lastT(frames), cfg)).toBeNull();
  });

  it('대각선 이동은 null (수직 편차 초과)', () => {
    const frames = linear(400, 2.5, 2.0);
    expect(detectSwipe(frames, lastT(frames), cfg)).toBeNull();
  });

  it('왕복(오른쪽 갔다 왼쪽)은 null (직진성 부족)', () => {
    const n = 15;
    const frames = motionFrames(n, (i) => ({ dx: (i < 7 ? i : 14 - i) * 0.08, dy: 0 }));
    expect(detectSwipe(frames, lastT(frames), cfg)).toBeNull();
  });

  it('추적이 끊긴 창은 null', () => {
    const frames = linear(400, 2.5);
    // 가운데 프레임들을 빼서 200ms 공백을 만든다
    const gapped = frames.filter((_, i) => i < 4 || i > 9);
    expect(detectSwipe(gapped, lastT(gapped), cfg)).toBeNull();
  });

  it('마지막 프레임이 오래됐으면(손 사라짐) null', () => {
    const frames = linear(400, 2.5);
    expect(detectSwipe(frames, lastT(frames) + 400, cfg)).toBeNull();
  });

  it('손이 작아도(멀어도) 손 크기 배수 기준이라 같은 판정', () => {
    const small = openHand().map((p) => ({ x: 0.5 + (p.x - 0.5) * 0.5, y: 0.8 + (p.y - 0.8) * 0.5 }));
    const n = 13;
    const frames = motionFrames(n, (i) => ({ dx: (i / (n - 1)) * 2.5 * HAND * 0.5, dy: 0 }), small);
    expect(detectSwipe(frames, lastT(frames), cfg)?.gesture).toBe('swipe_right');
  });
});

describe('signedRotationDeg', () => {
  const center = { x: 0, y: 0 };
  const onCircle = (degs: number[]) => degs.map((d) => ({ x: Math.cos((d * Math.PI) / 180), y: Math.sin((d * Math.PI) / 180) }));

  it('한 바퀴는 ±360에 가깝다', () => {
    const pts = onCircle(Array.from({ length: 37 }, (_, i) => i * 10));
    expect(signedRotationDeg(pts, center)).toBeCloseTo(360, 0);
  });

  it('왕복(0→90→0→90→0)은 부호 합이 0이지만 부호 없는 합은 크다', () => {
    const pts = onCircle([0, 30, 60, 90, 60, 30, 0, 30, 60, 90, 60, 30, 0]);
    expect(Math.abs(signedRotationDeg(pts, center))).toBeLessThan(1);
    expect(absRotationDeg(pts, center)).toBeCloseTo(360, 0);
  });

  it('±180 경계를 넘어도 연속으로 센다', () => {
    const pts = onCircle([170, 180, -170, -160]);
    expect(signedRotationDeg(pts, center)).toBeCloseTo(30, 5);
  });
});

describe('detectCircle', () => {
  it('검지 끝으로 반지름 0.75 손크기 원을 1.2초에 한 바퀴 → circle', () => {
    const frames = circular(1200, 0.75 * HAND, 1);
    const r = detectCircle(frames, lastT(frames), cfg);
    expect(r?.gesture).toBe('circle');
    expect(Math.abs(r!.detail.totalAngleDeg)).toBeGreaterThanOrEqual(cfg.circleMinAngleDeg);
    expect(r!.detail.radiusCv).toBeLessThanOrEqual(cfg.circleMaxRadiusCv);
    expect(r!.score).toBeGreaterThanOrEqual(cfg.minDynamicScore);
  });

  it('반대 방향 원도 circle (부호만 다름)', () => {
    const cw = circular(1200, 0.75 * HAND, 1);
    const ccw = circular(1200, 0.75 * HAND, -1);
    const a = detectCircle(cw, lastT(cw), cfg)!;
    const b = detectCircle(ccw, lastT(ccw), cfg)!;
    expect(a.gesture).toBe('circle');
    expect(b.gesture).toBe('circle');
    expect(Math.sign(a.detail.totalAngleDeg)).toBe(-Math.sign(b.detail.totalAngleDeg));
  });

  it('반 바퀴(180°)는 null', () => {
    const frames = circular(1200, 0.75 * HAND, 0.5);
    expect(detectCircle(frames, lastT(frames), cfg)).toBeNull();
  });

  it('좌우 왕복(흔들기)은 회전각이 상쇄되어 null', () => {
    const n = 40;
    const frames = motionFrames(n, (i) => ({ dx: Math.sin((i / n) * 6 * Math.PI) * 0.15, dy: 0 }), pointingHand());
    expect(detectCircle(frames, lastT(frames), cfg)).toBeNull();
  });

  it('반지름이 너무 작은 원은 null', () => {
    const frames = circular(1200, 0.2 * HAND, 1);
    expect(detectCircle(frames, lastT(frames), cfg)).toBeNull();
  });

  it('반지름이 들쭉날쭉한 궤적은 null', () => {
    const n = 37;
    const frames = motionFrames(
      n,
      (i) => {
        const a = (i / (n - 1)) * 2 * Math.PI;
        const r = HAND * (i % 2 === 0 ? 0.4 : 1.4); // 프레임마다 반지름이 0.4 ↔ 1.4 손크기로 튐
        return { dx: r * Math.cos(a), dy: r * Math.sin(a) };
      },
      pointingHand(),
    );
    expect(detectCircle(frames, lastT(frames), cfg)).toBeNull();
  });

  it('원을 그린 뒤 검지 끝 궤적만 보므로 손 모양은 무관하다(펼친 손도 circle)', () => {
    const frames = circular(1200, 0.75 * HAND, 1, openHand());
    expect(detectCircle(frames, lastT(frames), cfg)?.gesture).toBe('circle');
  });
});

describe('detectDynamic (통합 순서)', () => {
  it('완성된 원은 circle로, 스와이프보다 우선한다', () => {
    const frames = circular(1200, 1.2 * HAND, 1);
    expect(detectDynamic(frames, lastT(frames), cfg)?.gesture).toBe('circle');
  });

  it('검지로 큰 원을 그리는 동안 어느 시점에도 스와이프로 잡히지 않는다', () => {
    // 반지름 1.5 손크기, 느린 원: 호의 일부는 0.5초 창에서 x로 2 손크기 이상 움직인다
    const full = circular(1800, 1.5 * HAND, 1);
    let swipeFired = false;
    let circleFired = false;
    for (let i = 3; i < full.length; i++) {
      const r = detectDynamic(full.slice(0, i + 1), full[i].t, cfg);
      if (r?.gesture === 'circle') circleFired = true;
      else if (r) swipeFired = true;
    }
    expect(swipeFired).toBe(false);
    expect(circleFired).toBe(true);
  });

  it('검지만 편 손으로 직선 이동하면 스와이프가 아니다 (포인팅 손은 원 전용)', () => {
    const n = 13;
    const frames = motionFrames(n, (i) => ({ dx: (i / (n - 1)) * 2.5 * HAND, dy: 0 }), pointingHand());
    expect(detectDynamic(frames, lastT(frames), cfg)).toBeNull();
    expect(detectSwipe(frames, lastT(frames), cfg)).toBeNull();
  });

  it('펼친 손으로 원을 그리면 회전 진행 중 보류 규칙만 남는다(첫 호는 스와이프로 잡힐 수 있음 — 알려진 한계)', () => {
    // 이 케이스는 보장하지 않는다. 회귀 감시용으로 현재 동작만 기록한다: 완성된 원은 circle로 나온다.
    const full = circular(1800, 1.5 * HAND, 1, openHand());
    expect(detectDynamic(full, lastT(full), cfg)?.gesture).toBe('circle');
  });

  it('직선 스와이프는 원 분석에 걸리지 않고 swipe로 나온다', () => {
    const frames = linear(400, 2.5);
    expect(detectDynamic(frames, lastT(frames), cfg)?.gesture).toBe('swipe_right');
  });

  it('정지한 손은 null', () => {
    const frames = motionFrames(30, () => ({ dx: 0, dy: 0 }));
    expect(detectDynamic(frames, lastT(frames), cfg)).toBeNull();
  });

  it('검지 끝 인덱스는 8이다 (원 판정이 보는 점)', () => {
    expect(LM.INDEX_TIP).toBe(8);
  });
});

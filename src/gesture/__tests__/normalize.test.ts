import { describe, expect, it } from 'vitest';
import { handScale, normalizeHand } from '../normalize';
import { LM } from '../types';
import { openHand, transformHand } from './fixtures';

describe('normalizeHand', () => {
  it('손목을 원점으로, 손목–중지MCP 거리를 1로 만든다', () => {
    const { points, scale } = normalizeHand(openHand());
    expect(points[LM.WRIST].x).toBeCloseTo(0);
    expect(points[LM.WRIST].y).toBeCloseTo(0);
    const m = points[LM.MIDDLE_MCP];
    expect(Math.hypot(m.x, m.y)).toBeCloseTo(1);
    expect(scale).toBeCloseTo(0.2);
  });

  it('평행이동·배율이 달라도 정규화 결과는 같다', () => {
    const a = normalizeHand(openHand()).points;
    const b = normalizeHand(transformHand(openHand(), { dx: 0.2, dy: -0.3, scale: 0.4 })).points;
    for (let i = 0; i < a.length; i++) {
      expect(b[i].x).toBeCloseTo(a[i].x, 6);
      expect(b[i].y).toBeCloseTo(a[i].y, 6);
    }
  });

  it('handScale은 배율에 비례한다', () => {
    const base = handScale(openHand());
    expect(handScale(transformHand(openHand(), { scale: 0.5 }))).toBeCloseTo(base * 0.5);
  });

  it('손 크기가 0이어도 NaN을 내지 않는다', () => {
    const degenerate = openHand().map(() => ({ x: 0.5, y: 0.5 }));
    const { points } = normalizeHand(degenerate);
    expect(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});

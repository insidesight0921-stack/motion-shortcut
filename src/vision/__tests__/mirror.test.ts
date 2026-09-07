import { describe, expect, it } from 'vitest';
import { toUserFrame } from '../mirror';

describe('toUserFrame', () => {
  it('x만 1-x로 뒤집고 y, z는 유지한다', () => {
    const out = toUserFrame([{ x: 0.2, y: 0.7, z: -0.1 }]);
    expect(out[0].x).toBeCloseTo(0.8);
    expect(out[0].y).toBe(0.7);
    expect(out[0].z).toBe(-0.1);
  });

  it('원본에서 왼쪽으로 가는 움직임(사용자 오른쪽)이 x 증가가 된다', () => {
    // 카메라 원본: 사용자가 오른쪽으로 손을 옮기면 이미지 x는 감소한다.
    const raw = [{ x: 0.6, y: 0.5 }, { x: 0.4, y: 0.5 }];
    const [a, b] = toUserFrame(raw);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it('길이를 보존한다', () => {
    const raw = Array.from({ length: 21 }, (_, i) => ({ x: i / 21, y: 0 }));
    expect(toUserFrame(raw)).toHaveLength(21);
  });
});

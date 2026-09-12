import { describe, expect, it } from 'vitest';
import { HANDEDNESS_FLIP, toUserHand } from '../handedness';

describe('toUserHand', () => {
  it('거울 가정 때문에 라벨을 뒤집는다 (HANDEDNESS_FLIP)', () => {
    expect(HANDEDNESS_FLIP).toBe(true);
    expect(toUserHand('Left')).toBe('right');
    expect(toUserHand('Right')).toBe('left');
    expect(toUserHand('left')).toBe('right');
  });

  it('모르는 라벨·빈 값은 undefined', () => {
    expect(toUserHand(undefined)).toBeUndefined();
    expect(toUserHand('')).toBeUndefined();
    expect(toUserHand('Both')).toBeUndefined();
  });
});

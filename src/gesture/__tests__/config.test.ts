import { describe, expect, it } from 'vitest';
import { CONFIG_RANGES, DEFAULT_CONFIG } from '../config';

describe('DEFAULT_CONFIG', () => {
  it('모든 기본값이 슬라이더 범위 안에 있다', () => {
    for (const key of Object.keys(DEFAULT_CONFIG) as (keyof typeof DEFAULT_CONFIG)[]) {
      const range = CONFIG_RANGES[key];
      expect(range, `${key} 범위 없음`).toBeDefined();
      expect(DEFAULT_CONFIG[key]).toBeGreaterThanOrEqual(range.min);
      expect(DEFAULT_CONFIG[key]).toBeLessThanOrEqual(range.max);
    }
  });

  it('접힘 비율은 펼침 비율보다 작다(히스테리시스)', () => {
    expect(DEFAULT_CONFIG.fingerFoldRatio).toBeLessThan(DEFAULT_CONFIG.fingerExtendRatio);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { normalizeHand } from '../normalize';
import { classifyStaticPose, fingerStates } from '../static';
import type { Point } from '../types';
import { fistHand, makeHand, mirrorHand, openHand, pointingHand, rotateHand, transformHand } from './fixtures';

const cfg = DEFAULT_CONFIG;
const classify = (pts: Point[]) => classifyStaticPose(normalizeHand(pts).points, cfg);

describe('fingerStates', () => {
  it('펼친 손은 다섯 손가락 모두 펼침', () => {
    const f = fingerStates(normalizeHand(openHand()).points, cfg);
    expect([f.thumb, f.index, f.middle, f.ring, f.pinky]).toEqual([true, true, true, true, true]);
  });

  it('주먹은 다섯 손가락 모두 접힘', () => {
    const f = fingerStates(normalizeHand(fistHand()).points, cfg);
    expect([f.thumb, f.index, f.middle, f.ring, f.pinky]).toEqual([false, false, false, false, false]);
  });

  it('검지만 편 손은 검지만 펼침', () => {
    const f = fingerStates(normalizeHand(pointingHand()).points, cfg);
    expect([f.thumb, f.index, f.middle, f.ring, f.pinky]).toEqual([false, true, false, false, false]);
  });
});

describe('classifyStaticPose', () => {
  it('손바닥 펼침 → open_palm, 점수는 minPoseScore 이상', () => {
    const r = classify(openHand());
    expect(r.pose).toBe('open_palm');
    expect(r.score).toBeGreaterThanOrEqual(cfg.minPoseScore);
  });

  it('주먹 → fist', () => {
    const r = classify(fistHand());
    expect(r.pose).toBe('fist');
    expect(r.score).toBeGreaterThanOrEqual(cfg.minPoseScore);
  });

  it('엄지를 편 주먹(따봉)도 fist (엄지는 주먹 판정에서 제외)', () => {
    const r = classify(makeHand({ thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' }));
    expect(r.pose).toBe('fist');
  });

  it('엄지를 접고 나머지를 편 손은 open_palm이 아니다', () => {
    const r = classify(makeHand({ thumb: 'folded' }));
    expect(r.pose).toBeNull();
  });

  it('검지만 편 손은 어느 포즈도 아니다', () => {
    expect(classify(pointingHand()).pose).toBeNull();
  });

  it('한 손가락만 접힌 손은 어느 포즈도 아니다', () => {
    expect(classify(makeHand({ ring: 'folded' })).pose).toBeNull();
  });

  it('위치·크기가 달라도 같은 판정', () => {
    expect(classify(transformHand(openHand(), { dx: -0.3, dy: 0.1, scale: 0.35 })).pose).toBe('open_palm');
    expect(classify(transformHand(fistHand(), { dx: 0.25, dy: -0.2, scale: 2 })).pose).toBe('fist');
  });

  it('손이 기울어져도(±60°) 같은 판정', () => {
    for (const deg of [-60, -30, 30, 60]) {
      const rad = (deg * Math.PI) / 180;
      expect(classify(rotateHand(openHand(), rad)).pose, `open ${deg}°`).toBe('open_palm');
      expect(classify(rotateHand(fistHand(), rad)).pose, `fist ${deg}°`).toBe('fist');
    }
  });

  it('왼손(좌우 반전)도 같은 판정 — 엄지 규칙이 손 방향에 무관 (D-004)', () => {
    expect(classify(mirrorHand(openHand())).pose).toBe('open_palm');
    expect(classify(mirrorHand(fistHand())).pose).toBe('fist');
    expect(classify(mirrorHand(makeHand({ thumb: 'folded' }))).pose).toBeNull();
  });

  it('점수는 손가락이 임계값에 가까울수록 낮아진다', () => {
    const solid = classify(openHand()).score;
    // 새끼손가락 끝을 PIP 쪽으로 조금 당겨 애매하게 만든다
    const weak = openHand();
    weak[20] = { x: weak[20].x, y: weak[20].y + 0.07 };
    const r = classify(weak);
    expect(r.pose).toBe('open_palm');
    expect(r.score).toBeLessThan(solid);
  });
});

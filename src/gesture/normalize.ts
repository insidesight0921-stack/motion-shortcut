import { LM, type Point } from './types';

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 손 크기 = 손목(0)–중지 MCP(9) 거리.
 * 손가락을 접거나 펴도 거의 변하지 않는 구간이라 크기 기준으로 적합하다.
 */
export function handScale(landmarks: Point[]): number {
  return dist(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]);
}

export interface NormalizedHand {
  /** 손목이 원점, 손 크기가 1인 좌표 */
  points: Point[];
  /** 원본 좌표에서의 손 크기 (0~1 이미지 단위) */
  scale: number;
  /** 원본 좌표에서의 손목 위치 */
  origin: Point;
}

/**
 * 정규화: 손목 기준 평행이동 + 손 크기로 나누기.
 * 결과는 "손이 화면 어디에 있든, 카메라에서 얼마나 멀든" 같은 모양이면 같은 값이 된다.
 * 회전은 보정하지 않는다(정적 포즈 규칙이 손목 거리 기반이라 회전에 이미 강함).
 *
 * 주의: 평행이동을 제거하므로 스와이프 같은 이동 제스처에는 이 좌표를 쓰면 안 된다 (D-006).
 */
export function normalizeHand(landmarks: Point[]): NormalizedHand {
  const origin = landmarks[LM.WRIST];
  const scale = handScale(landmarks);
  const s = scale > 1e-6 ? scale : 1e-6;
  const points = landmarks.map((p) => ({
    x: (p.x - origin.x) / s,
    y: (p.y - origin.y) / s,
    z: p.z === undefined ? undefined : p.z / s,
  }));
  return { points, scale, origin };
}

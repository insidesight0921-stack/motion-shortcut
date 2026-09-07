/**
 * 인식 파이프라인 공용 타입.
 * 이 파일과 gesture/ 아래 모듈은 브라우저 API를 import하지 않는다.
 *
 * 좌표계: 모든 Point는 "사용자 시점 프레임"이다.
 *   - x, y는 0~1 (이미지 폭·높이 기준), vision/mirror.ts에서 이미 x → 1-x 적용됨
 *   - 사용자 오른쪽 = x 증가 = 화면(거울 미리보기) 오른쪽
 *   - y는 아래로 증가 (이미지 좌표 관례)
 */
export interface Point {
  x: number;
  y: number;
  z?: number;
}

/** 한 프레임의 한 손. landmarks는 항상 21개. */
export interface HandFrame {
  /** 타임스탬프(ms). 단조 증가. */
  t: number;
  /** 21개 랜드마크, 사용자 시점 프레임 */
  landmarks: Point[];
  /** HandLandmarker가 준 손 신뢰도 (handedness score, 0~1) */
  score: number;
}

export type StaticPose = 'open_palm' | 'fist';
export type DynamicGesture = 'swipe_left' | 'swipe_right' | 'circle';
export type GestureId = StaticPose | DynamicGesture;

export const ALL_GESTURES: GestureId[] = ['open_palm', 'fist', 'swipe_left', 'swipe_right', 'circle'];

export function isStaticGesture(g: GestureId): g is StaticPose {
  return g === 'open_palm' || g === 'fist';
}

/** 동적 제스처 판정 결과 (dynamic.ts가 생성) */
export interface DynamicResult {
  gesture: DynamicGesture;
  /** 0~1 자체 판정 점수 */
  score: number;
  /** 디버그용 세부 수치 (dx, dy, totalAngleDeg, radiusCv 등) */
  detail: Record<string, number>;
}

/** 랜드마크 인덱스 (MediaPipe Hand 21점 모델) */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export const LANDMARK_COUNT = 21;

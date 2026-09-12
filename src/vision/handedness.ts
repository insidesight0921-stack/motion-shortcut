/**
 * MediaPipe handedness 라벨 → 사용자 기준 손.
 *
 * HandLandmarker 는 입력 이미지가 **거울(셀피) 이미지라고 가정**하고 Left/Right 를 매긴다.
 * 우리는 원본(비거울) 프레임을 넣으므로 라벨이 사용자 기준과 반대로 나올 가능성이 크다.
 * 반전은 여기 한 곳에서만 한다 (D-003 과 같은 원칙). 1차 실기 항목 1 에서 확인하고 틀리면 상수 하나만 바꾼다.
 */
export const HANDEDNESS_FLIP = true;

export type UserHand = 'left' | 'right';

export function toUserHand(categoryName: string | undefined | null): UserHand | undefined {
  if (!categoryName) return undefined;
  const c = categoryName.toLowerCase();
  const raw: UserHand | undefined = c.startsWith('left') ? 'left' : c.startsWith('right') ? 'right' : undefined;
  if (!raw) return undefined;
  if (!HANDEDNESS_FLIP) return raw;
  return raw === 'left' ? 'right' : 'left';
}

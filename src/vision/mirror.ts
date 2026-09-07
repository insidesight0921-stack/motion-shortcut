import type { Point } from '../gesture/types';

/**
 * 카메라 원본 프레임 → 사용자 시점 프레임.
 *
 * 전면 카메라 원본 이미지에서는 사용자의 오른손이 이미지 왼쪽에 찍힌다.
 * 미리보기 <video>는 CSS scaleX(-1)로 거울 표시하므로, 랜드마크도 같은 방향으로
 * 뒤집어야 화면과 판정이 일치한다.
 *
 * 이 함수가 좌우 반전이 일어나는 **유일한** 지점이다. 이후 파이프라인·오버레이·테스트는
 * 전부 "사용자 오른쪽 = x 증가 = 화면 오른쪽"을 가정한다. (docs/DECISIONS.md D-003)
 */
export function toUserFrame(landmarks: ReadonlyArray<{ x: number; y: number; z?: number }>): Point[] {
  return landmarks.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
}

import { HandLandmarker } from '@mediapipe/tasks-vision';
import type { Point } from '../gesture/types';
import { LM } from '../gesture/types';

/** CSS 토큰을 캔버스 색으로 읽는다. 캔버스는 CSS 변수를 직접 못 쓰므로 여기서 한 번 해석한다. */
function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * 사용자 시점 프레임의 랜드마크를 캔버스에 그린다. 색은 brand-accent 토큰 (docs/DESIGN.md).
 * 캔버스는 CSS로 뒤집지 않는다. 좌표가 이미 거울 변환돼 있으므로 그대로 그리면
 * 거울 표시된 <video>와 겹친다. (docs/DECISIONS.md D-003)
 */
export function drawHand(ctx: CanvasRenderingContext2D, landmarks: Point[], width: number, height: number): void {
  const accent = token('--brand-accent', '#3182f6');
  const surface = token('--surface-card', '#ffffff');

  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    const emphasized = i === LM.INDEX_TIP || i === LM.WRIST;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, emphasized ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = emphasized ? accent : surface;
    ctx.fill();
    if (!emphasized) ctx.stroke();
  }
}

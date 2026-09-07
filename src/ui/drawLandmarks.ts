import { HandLandmarker } from '@mediapipe/tasks-vision';
import type { Point } from '../gesture/types';
import { LM } from '../gesture/types';

/**
 * 사용자 시점 프레임의 랜드마크를 캔버스에 그린다.
 * 캔버스는 CSS로 뒤집지 않는다. 좌표가 이미 거울 변환돼 있으므로 그대로 그리면
 * 거울 표시된 <video>와 겹친다. (docs/DECISIONS.md D-003)
 */
export function drawHand(ctx: CanvasRenderingContext2D, landmarks: Point[], width: number, height: number): void {
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(79, 140, 255, 0.9)';
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
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, i === LM.INDEX_TIP ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = i === LM.WRIST ? '#f5a623' : i === LM.INDEX_TIP ? '#38c172' : '#ffffff';
    ctx.fill();
  }
}

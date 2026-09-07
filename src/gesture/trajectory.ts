import type { HandFrame } from './types';

/**
 * 최근 N ms 동안의 손 프레임을 시간순으로 보관하는 버퍼.
 * 동적 제스처(스와이프, 원)와 유지 중 속도 계산에 쓴다.
 *
 * 저장하는 좌표는 사용자 시점 프레임의 원본(0~1) 좌표다. 정규화 좌표를 넣으면
 * 평행이동이 사라져 스와이프를 볼 수 없다 (D-006).
 *
 * 명령 실행 직후에는 반드시 clear()한다. 남아 있는 궤적이 다음 틱에서 같은 제스처로
 * 재검출되는 것을 막기 위해서다 (D-008). 호출 지점은 pipeline.ts.
 */
export class TrajectoryBuffer {
  private frames: HandFrame[] = [];

  constructor(private maxAgeMs: number) {}

  setMaxAge(ms: number): void {
    this.maxAgeMs = ms;
  }

  get length(): number {
    return this.frames.length;
  }

  push(frame: HandFrame): void {
    // 타임스탬프 역행 프레임은 무시 (detectForVideo 규칙과 동일)
    const last = this.frames[this.frames.length - 1];
    if (last && frame.t <= last.t) return;
    this.frames.push(frame);
    this.prune(frame.t);
  }

  /** now 기준 최근 ms 안의 프레임 (오래된 것부터) */
  window(ms: number, now: number): HandFrame[] {
    const from = now - ms;
    let i = 0;
    while (i < this.frames.length && this.frames[i].t < from) i++;
    return this.frames.slice(i);
  }

  latest(): HandFrame | null {
    return this.frames[this.frames.length - 1] ?? null;
  }

  clear(): void {
    this.frames = [];
  }

  private prune(now: number): void {
    const from = now - this.maxAgeMs;
    let i = 0;
    while (i < this.frames.length && this.frames[i].t < from) i++;
    if (i > 0) this.frames.splice(0, i);
  }
}

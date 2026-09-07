import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { HandFrame } from '../gesture/types';
import { describeCameraError, startCamera, stopCamera } from './camera';
import { createHandLandmarker, DEFAULT_LANDMARKER_OPTIONS, type LandmarkerOptions } from './landmarker';
import { toUserFrame } from './mirror';

/** 프레임 리스너가 받는 값. frame이 null이면 손이 없다. */
export interface VisionTick {
  /** performance.now() 기반 ms 타임스탬프 */
  t: number;
  frame: HandFrame | null;
  /** 디버그·오버레이용 원본 결과 */
  raw: HandLandmarkerResult;
}

export type VisionStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

type FrameListener = (tick: VisionTick) => void;
type StatusListener = (status: VisionStatus, error: string | null) => void;

/**
 * 카메라 + HandLandmarker + 프레임 루프를 묶은 세션.
 * React 밖에서 동작하며, 프레임마다 리스너를 호출한다(React state를 프레임마다 갱신하지 않기 위함).
 */
export class VisionSession {
  private landmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private frameListeners = new Set<FrameListener>();
  private statusListeners = new Set<StatusListener>();
  private rafId: number | null = null;
  private vfcId: number | null = null;
  private lastTimestamp = -1;
  private running = false;
  status: VisionStatus = 'idle';
  error: string | null = null;

  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.error);
    return () => this.statusListeners.delete(listener);
  }

  async start(video: HTMLVideoElement, opts: LandmarkerOptions = DEFAULT_LANDMARKER_OPTIONS): Promise<void> {
    if (this.running) return;
    this.video = video;
    this.setStatus('starting');
    // 모델 로드와 카메라 권한 요청을 병렬로 진행. 한쪽이 실패해도 다른 쪽 자원을 정리해야 하므로 allSettled.
    const [lm, cam] = await Promise.allSettled([createHandLandmarker(opts), startCamera(video)]);
    if (lm.status === 'rejected' || cam.status === 'rejected') {
      if (lm.status === 'fulfilled') lm.value.close();
      if (cam.status === 'fulfilled') stopCamera(video);
      const err = lm.status === 'rejected' ? lm.reason : (cam as PromiseRejectedResult).reason;
      this.error = describeCameraError(err);
      this.setStatus('error');
      throw err;
    }
    this.landmarker = lm.value;
    this.running = true;
    this.lastTimestamp = -1;
    this.setStatus('running');
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.vfcId !== null && this.video && 'cancelVideoFrameCallback' in this.video) {
      this.video.cancelVideoFrameCallback(this.vfcId);
    }
    this.rafId = null;
    this.vfcId = null;
    if (this.video) stopCamera(this.video);
    this.landmarker?.close();
    this.landmarker = null;
    this.setStatus('stopped');
  }

  private setStatus(status: VisionStatus): void {
    this.status = status;
    if (status !== 'error') this.error = null;
    for (const l of this.statusListeners) l(status, this.error);
  }

  private scheduleNext(): void {
    if (!this.running || !this.video) return;
    // requestVideoFrameCallback은 새 비디오 프레임이 올 때만 호출되어 같은 프레임을 두 번 추론하지 않는다.
    if ('requestVideoFrameCallback' in this.video) {
      this.vfcId = this.video.requestVideoFrameCallback(() => this.tick());
    } else {
      this.rafId = requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (!this.running || !this.video || !this.landmarker) return;
    const video = this.video;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      // detectForVideo는 단조 증가하는 ms 타임스탬프를 요구한다.
      let t = performance.now();
      if (t <= this.lastTimestamp) t = this.lastTimestamp + 1;
      this.lastTimestamp = t;

      const raw = this.landmarker.detectForVideo(video, t);
      const hand = raw.landmarks[0];
      const frame: HandFrame | null = hand
        ? {
            t,
            landmarks: toUserFrame(hand),
            // handedness score를 손 신뢰도로 사용 (HandLandmarkerResult가 노출하는 유일한 손 단위 점수)
            score: raw.handedness[0]?.[0]?.score ?? 1,
          }
        : null;
      const tick: VisionTick = { t, frame, raw };
      for (const l of this.frameListeners) l(tick);
    }
    this.scheduleNext();
  }
}

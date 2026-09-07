import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HAND_MODEL_URL, WASM_BASE_URL } from './assets';

/**
 * HandLandmarker 생성 옵션. 값은 @mediapipe/tasks-vision 1.0.1의
 * HandLandmarkerOptions(vision.d.ts)에서 확인한 필드만 쓴다.
 */
export interface LandmarkerOptions {
  /** 'GPU'가 기본. WebGL 문제가 있는 환경에서는 'CPU'로 전환 (docs/DECISIONS.md D-002) */
  delegate: 'GPU' | 'CPU';
  minHandDetectionConfidence: number;
  minHandPresenceConfidence: number;
  minTrackingConfidence: number;
}

export const DEFAULT_LANDMARKER_OPTIONS: LandmarkerOptions = {
  delegate: 'GPU',
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

export async function createHandLandmarker(opts: LandmarkerOptions = DEFAULT_LANDMARKER_OPTIONS): Promise<HandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: HAND_MODEL_URL,
      delegate: opts.delegate,
    },
    runningMode: 'VIDEO',
    // 한 손 제스처만 다룬다(확정 결정). 두 손은 확장 지점으로만 남긴다.
    numHands: 1,
    minHandDetectionConfidence: opts.minHandDetectionConfidence,
    minHandPresenceConfidence: opts.minHandPresenceConfidence,
    minTrackingConfidence: opts.minTrackingConfidence,
  });
}

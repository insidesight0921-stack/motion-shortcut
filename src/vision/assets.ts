/**
 * MediaPipe 에셋 경로. CDN → 로컬 번들 전환은 이 파일만 바꾸면 된다.
 *
 * 주의: WASM 버전은 반드시 설치된 @mediapipe/tasks-vision 패키지 버전과 같아야 한다.
 * JS 번들(vision_bundle.mjs)과 WASM이 어긋나면 초기화 단계에서 실패한다.
 *
 * 로컬 번들로 바꾸려면:
 *   1) node_modules/@mediapipe/tasks-vision/wasm/* 를 public/mediapipe/wasm/ 으로 복사
 *   2) hand_landmarker.task 를 public/models/ 로 다운로드
 *   3) 아래 두 상수를 '/mediapipe/wasm', '/models/hand_landmarker.task' 로 변경
 */
export const TASKS_VISION_VERSION = '1.0.1';

export const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;

export const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

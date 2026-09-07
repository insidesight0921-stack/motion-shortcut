import { create } from 'zustand';
import type { VisionStatus } from '../vision/session';

interface GestureStoreState {
  visionStatus: VisionStatus;
  visionError: string | null;
  fps: number;
  handDetected: boolean;

  setVisionStatus: (status: VisionStatus, error: string | null) => void;
  setFrameStats: (fps: number, handDetected: boolean) => void;
}

/**
 * 인식 관련 UI 상태. 프레임마다 갱신하지 않고 세션이 스로틀해서 넣는다.
 */
export const useGestureStore = create<GestureStoreState>((set) => ({
  visionStatus: 'idle',
  visionError: null,
  fps: 0,
  handDetected: false,

  setVisionStatus: (visionStatus, visionError) => set({ visionStatus, visionError }),
  setFrameStats: (fps, handDetected) => set({ fps, handDetected }),
}));

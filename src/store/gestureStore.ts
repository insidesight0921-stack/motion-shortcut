import { create } from 'zustand';
import { DEFAULT_CONFIG, type GestureConfig } from '../gesture/config';
import type { HudState } from '../gesture/pipeline';
import type { VisionStatus } from '../vision/session';

export const INITIAL_HUD: HudState = {
  phase: 'idle',
  candidate: null,
  progress: 0,
  cooldownRemainingMs: 0,
  lastExecuted: null,
  lastExecutedAt: -Infinity,
  handScore: null,
  staticPose: null,
  dynamic: null,
  motion: 0,
};

interface GestureStoreState {
  visionStatus: VisionStatus;
  visionError: string | null;
  fps: number;
  handDetected: boolean;

  /** 모션 단축키 활성화. false여도 fist(토글)는 인식된다. */
  enabled: boolean;
  hud: HudState;
  config: GestureConfig;

  setVisionStatus: (status: VisionStatus, error: string | null) => void;
  setFrameStats: (fps: number, handDetected: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  setHud: (hud: HudState) => void;
  setConfig: (patch: Partial<GestureConfig>) => void;
  resetConfig: () => void;
}

/**
 * 인식 관련 UI 상태. HUD는 프레임마다가 아니라 엔진이 스로틀해서 넣는다.
 * 인식 루프는 React 밖에서 돌며 getState()로 enabled/config를 읽는다.
 */
export const useGestureStore = create<GestureStoreState>((set) => ({
  visionStatus: 'idle',
  visionError: null,
  fps: 0,
  handDetected: false,

  enabled: true,
  hud: INITIAL_HUD,
  config: DEFAULT_CONFIG,

  setVisionStatus: (visionStatus, visionError) => set({ visionStatus, visionError }),
  setFrameStats: (fps, handDetected) => set({ fps, handDetected }),
  setEnabled: (enabled) => set({ enabled }),
  toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),
  setHud: (hud) => set({ hud }),
  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  resetConfig: () => set({ config: DEFAULT_CONFIG }),
}));

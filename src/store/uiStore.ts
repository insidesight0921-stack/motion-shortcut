import { create } from 'zustand';

/** 오른쪽 패널에 보이는 화면 (기획서 §21). 카메라·HUD 는 왼쪽에 항상 있다 (§18 카메라 상태 상시 표시) */
export type View = 'home' | 'profile' | 'gestures' | 'standby';

interface UiState {
  view: View;
  /** 키 캡처 입력이 열려 있는 동안 true. 이때 매핑 실행은 일시 중지된다 (D-015 보완 1) */
  capturing: boolean;
  setView: (view: View) => void;
  setCapturing: (capturing: boolean) => void;
}

/** 화면 전용 임시 상태 (저장하지 않는다) */
export const useUiStore = create<UiState>((set) => ({
  view: 'home',
  capturing: false,
  setView: (view) => set({ view }),
  setCapturing: (capturing) => set({ capturing }),
}));

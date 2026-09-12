import { create } from 'zustand';

interface UiState {
  /** 키 캡처 입력이 열려 있는 동안 true. 이때 매핑 실행은 일시 중지된다 (D-015 보완 1) */
  capturing: boolean;
  setCapturing: (capturing: boolean) => void;
}

/** 화면 전용 임시 상태 (저장하지 않는다) */
export const useUiStore = create<UiState>((set) => ({
  capturing: false,
  setCapturing: (capturing) => set({ capturing }),
}));

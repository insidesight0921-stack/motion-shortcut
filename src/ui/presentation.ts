import type { ModeId } from '../modes/types';
import { useModeStore } from '../store/modeStore';

/**
 * 발표 대기 화면의 버튼 규칙 (1차 승인 사항).
 *  - 카메라가 꺼져 있으면 "카메라 시작"이 primary 이고 "발표 시작"은 disabled
 *  - 카메라가 켜져 있고 MOTION OFF(standby) 면 "발표 시작"이 primary
 *  - 발표 중(사용자 모드)이면 "발표 종료"(Secondary) 만 보인다 → 화면당 파란 면은 항상 하나 이하
 */
export interface PresentationControls {
  /** 어떤 버튼이 primary 인가. 발표 중에는 없음 */
  primary: 'camera' | 'start' | null;
  startEnabled: boolean;
  presenting: boolean;
  startLabel: '발표 시작' | '발표 종료';
}

export function presentationControls(cameraRunning: boolean, mode: ModeId): PresentationControls {
  const presenting = mode !== 'standby';
  if (presenting) return { primary: null, startEnabled: true, presenting: true, startLabel: '발표 종료' };
  if (!cameraRunning) return { primary: 'camera', startEnabled: false, presenting: false, startLabel: '발표 시작' };
  return { primary: 'start', startEnabled: true, presenting: false, startLabel: '발표 시작' };
}

/** 발표 시작 = standby → 이전 사용자 모드(없으면 slide). panel 상태 전송은 useAgent 의 구독이 자동으로 한다 */
export function startPresentation(): boolean {
  return useModeStore.getState().wake('ui');
}

/** 발표 종료 = MOTION OFF */
export function endPresentation(): boolean {
  return useModeStore.getState().standby('ui');
}

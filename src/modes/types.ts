import type { Mapping } from '../mapping/types';
import { PRESENTATION_MODES, type PresentationModeId } from '../profile/types';

/**
 * 발표 제어 모드 (기획서 §11·§12, D-017).
 *  slide(기본) / cursor / laser / asset + 시스템 모드 standby(= MOTION OFF).
 * 전환 경로: 양손 검지 교차 → 방향 이동(2차), 화면 세그먼트, 키보드 Ctrl+Shift+1~4/0, (실험) 음성.
 */
export type ModeId = PresentationModeId | 'standby';

/** 사용자 모드 순서 = 세그먼트 표시 순서 = Ctrl+Shift+1~4 */
export const MODE_ORDER = PRESENTATION_MODES;
export type UserModeId = PresentationModeId;

export const STANDBY: ModeId = 'standby';

export function isUserMode(id: ModeId): id is UserModeId {
  return id !== 'standby';
}

/** 진입 제스처(양손 검지 교차 유지) 뒤 이동 방향 (2차) */
export type EntryDirection = 'up' | 'down' | 'left' | 'right';

/** 전환을 일으킨 경로. standby 해제는 voice/ui/key/gesture(양손 교차)만. 'agent' 는 긴급 정지(진입만) */
export type SwitchSource = 'voice' | 'ui' | 'key' | 'gesture' | 'agent' | 'init';

export interface ModeDef {
  id: ModeId;
  /** "슬라이드", "커서" … 오버레이 라벨은 labelEn */
  name: string;
  /** SLIDE MODE / CURSOR MODE / LASER MODE / ASSET MODE / MOTION OFF (§12) */
  labelEn: string;
  description: string;
  /** 정규화 전 원문. voice/keywords.ts 가 정규화·매칭한다 (실험 기능) */
  voiceAliases: string[];
  /** Ctrl+Shift+N */
  shortcutDigit: '0' | '1' | '2' | '3' | '4';
  /** 양손 교차 뒤 이 방향으로 이동하면 이 모드 (2차). standby 는 null */
  entryDirection: EntryDirection | null;
  /** 매 프레임 좌표를 보내는 연속 제어 (2차). slide/asset 은 null */
  continuousControl: 'cursor' | 'laser' | null;
  /** standby 는 null (매핑 없음, 편집기 숨김) */
  defaultMapping: Mapping | null;
  /** 자리만 남긴다. 사용자 정의 제스처 등록은 5차 */
  customGestures: never[];
}

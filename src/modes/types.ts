import type { Mapping } from '../mapping/types';

/**
 * 모드 = 매핑 + (나중에) 사용자 정의 제스처 세트 + 데모 대상 의 묶음.
 * 전환은 음성·화면·키보드 세 경로가 항상 공존한다. 음성은 전환과 대기 해제에만 쓴다 (D-016).
 */
export type ModeId = 'media' | 'reading' | 'presentation' | 'meeting' | 'standby';

/** 사용자 모드 (대기 제외). 세그먼트 표시 순서이자 Ctrl+Shift+1~4 순서 */
export const MODE_ORDER = ['media', 'reading', 'presentation', 'meeting'] as const;
export type UserModeId = (typeof MODE_ORDER)[number];

export const STANDBY: ModeId = 'standby';

export function isUserMode(id: ModeId): id is UserModeId {
  return id !== 'standby';
}

export type TargetId = 'youtube' | 'timer' | 'lastKey';

/** 전환을 일으킨 경로. wake 는 voice/ui/key 만 허용한다 (제스처로는 대기가 풀리지 않는다) */
export type SwitchSource = 'voice' | 'ui' | 'key' | 'init';

export interface ModeDef {
  id: ModeId;
  /** "미디어", "발표" … TTS는 `${name} 모드` */
  name: string;
  /** 빈 프리셋은 사실만 적는다 ("이 모드의 대상은 다음 단계에서 추가됩니다") */
  description: string;
  /** 정규화 전 원문. voice/keywords.ts 가 정규화·매칭한다 */
  voiceAliases: string[];
  /** Ctrl+Shift+N */
  shortcutDigit: '0' | '1' | '2' | '3' | '4';
  /** standby 는 null (매핑 없음, 편집기 숨김) */
  defaultMapping: Mapping | null;
  /** 이 모드에서 보여 줄 데모 대상. 빈 배열이면 빈 상태 카드 */
  targets: TargetId[];
  /** 자리만 남긴다. 사용자 정의 제스처 등록은 이번 범위 밖 */
  customGestures: never[];
}

import type { CommandId, CommandParams } from '../commands/types';
import type { GestureId } from '../gesture/types';

export interface MappingEntry {
  commandId: CommandId;
  params: CommandParams;
}

/** 제스처 5개 → 명령. 주먹(fist)은 항상 system.toggleEnabled 로 고정된다 */
export type Mapping = Record<GestureId, MappingEntry>;

export const MAPPING_VERSION = 1 as const;

/** 저장 형식. 버전 필드는 나중에 프리셋/내보내기로 확장할 때 마이그레이션 기준이 된다 */
export interface StoredMapping {
  version: typeof MAPPING_VERSION;
  mapping: Mapping;
}

export const MAPPING_STORAGE_KEY = 'motion-shortcut.mapping.v1';

/** 편집 불가 제스처 (안전장치: 잠금 해제 경로) */
export const LOCKED_GESTURE: GestureId = 'fist';
export const LOCKED_ENTRY: MappingEntry = { commandId: 'system.toggleEnabled', params: {} };

/** 편집기 표시 순서 */
export const GESTURE_ORDER: GestureId[] = ['open_palm', 'swipe_right', 'swipe_left', 'circle', 'fist'];

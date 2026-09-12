import { isCommandId } from '../commands/registry';
import type { CommandId } from '../commands/types';
import { ALL_GESTURES, type GestureId } from '../gesture/types';
import { emptyMapping } from '../mapping/defaults';
import { normalizeMapping } from '../mapping/storage';
import { LOCKED_GESTURE, MAPPING_STORAGE_KEY, type Mapping } from '../mapping/types';
import { defaultSlideMapping } from './defaults';
import type { MappingByPresentationMode, Program } from './types';

/**
 * 이전 저장 형식 → 프로필 v3 (D-017).
 *
 *   v1  'motion-shortcut.mapping.v1'  { version:1, mapping }                 (단일 매핑 = 옛 media)
 *   v2  'motion-shortcut.mapping.v2'  { version:2, byMode:{ media, reading, presentation, meeting } }
 *
 * 규칙:
 *  - v2.presentation → slide. 그 위에 v2.media 의 key.press 항목만 병합 (제스처가 겹치면 presentation 우선)
 *  - v1 만 있으면 v1.mapping 을 media 로 보고 같은 규칙
 *  - 슬라이드 모드에 남길 수 없는 명령(media.*, timer.toggle 등)은 none
 *  - cursor/laser/asset 은 빈 프리셋, 주먹은 고정
 * 옛 모드 이름은 여기서만 안다 (modes/catalog 와 무관하게 읽기 전용).
 */
export const LEGACY_MODE_IDS = ['media', 'reading', 'presentation', 'meeting'] as const;
type LegacyModeId = (typeof LEGACY_MODE_IDS)[number];

/** 슬라이드 모드에 남길 수 있는 명령 (옛 media.*·timer.toggle 은 제외된다) */
export const SLIDE_ALLOWED_COMMANDS: readonly string[] = [
  'slide.next',
  'slide.prev',
  'slide.first',
  'slide.goto',
  'slide.start',
  'slide.blackout',
  'slide.return',
  'key.press',
  'none',
  'system.toggleEnabled',
];

export function isSlideAllowed(id: CommandId): boolean {
  return SLIDE_ALLOWED_COMMANDS.includes(id);
}

export const LEGACY_V2_KEY = 'motion-shortcut.mapping.v2';

function readJson(s: Storage, key: string): unknown {
  try {
    const text = s.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** 옛 저장소에서 legacy 모드별 매핑을 읽는다. 없으면 null */
export function readLegacyByMode(s: Storage): Partial<Record<LegacyModeId, Mapping>> | null {
  const v2 = readJson(s, LEGACY_V2_KEY) as { version?: unknown; byMode?: Record<string, unknown> } | null;
  if (v2 && v2.version === 2 && v2.byMode && typeof v2.byMode === 'object') {
    const out: Partial<Record<LegacyModeId, Mapping>> = {};
    for (const m of LEGACY_MODE_IDS) {
      if (v2.byMode[m]) out[m] = normalizeMapping(v2.byMode[m], emptyMapping());
    }
    return out;
  }
  const v1 = readJson(s, MAPPING_STORAGE_KEY) as { version?: unknown; mapping?: unknown } | null;
  if (v1 && v1.version === 1 && v1.mapping) {
    return { media: normalizeMapping(v1.mapping, emptyMapping()) };
  }
  return null;
}

/** 옛 모드별 매핑 → v3 mappingByMode */
export function migrateLegacyToProfileMapping(legacy: Partial<Record<LegacyModeId, Mapping>>, program: Program): MappingByPresentationMode {
  const slide = emptyMapping();
  const presentation = legacy.presentation;
  const media = legacy.media;

  for (const g of ALL_GESTURES) {
    if (g === LOCKED_GESTURE) continue;
    const fromPresentation = presentation?.[g];
    const fromMedia = media?.[g];
    let chosen = fromPresentation && fromPresentation.commandId !== 'none' ? fromPresentation : undefined;
    if (!chosen && fromMedia && fromMedia.commandId === 'key.press') chosen = fromMedia;
    if (chosen && isCommandId(chosen.commandId) && isSlideAllowed(chosen.commandId)) {
      slide[g] = { commandId: chosen.commandId, params: { ...chosen.params } };
    }
  }

  // 옛 데이터가 전부 비어 있으면(손대지 않은 프리셋) 새 기본값을 쓴다
  const touched = (Object.keys(slide) as GestureId[]).some((g) => g !== LOCKED_GESTURE && slide[g].commandId !== 'none');
  return {
    slide: touched ? slide : defaultSlideMapping(program),
    cursor: emptyMapping(),
    laser: emptyMapping(),
    asset: emptyMapping(),
  };
}

import { isCommandId, validateParams } from '../commands/registry';
import { COMMANDS, defaultParams } from '../commands/catalog';
import { ALL_GESTURES, type GestureId } from '../gesture/types';
import { MODES } from '../modes/catalog';
import { MODE_ORDER, type UserModeId } from '../modes/types';
import { cloneMapping, DEFAULT_MAPPING } from './defaults';
import { LOCKED_ENTRY, LOCKED_GESTURE, MAPPING_STORAGE_KEY, MAPPING_VERSION, type Mapping, type MappingEntry, type StoredMapping } from './types';

/* ------------------------------------------------------------------ */
/* 항목·매핑 정규화                                                    */
/* ------------------------------------------------------------------ */

/** 항목 하나를 검증해 쓸 수 있는 형태로 만든다. 못 쓰면 null */
function normalizeEntry(gesture: GestureId, raw: unknown): MappingEntry | null {
  if (gesture === LOCKED_GESTURE) return { ...LOCKED_ENTRY, params: {} };
  if (!raw || typeof raw !== 'object') return null;
  const { commandId, params } = raw as { commandId?: unknown; params?: unknown };
  if (!isCommandId(commandId)) return null;
  const def = COMMANDS[commandId];
  if (!def.assignable) return null; // system.* 은 다른 제스처에 붙일 수 없다
  const p = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
  const candidate = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'number' || typeof v === 'string')) as Record<string, number | string>;
  const v = validateParams(def, Object.keys(candidate).length ? candidate : defaultParams(def));
  if (!v.ok) return null;
  return { commandId, params: v.params };
}

/**
 * 임의 입력 → 유효한 Mapping. 항목 단위로 검증해 못 쓰는 항목만 base 의 값으로 대체한다.
 * 주먹은 입력이 무엇이든 고정값으로 덮어쓴다 (안전장치).
 */
export function normalizeMapping(input: unknown, base: Mapping = DEFAULT_MAPPING): Mapping {
  const out = cloneMapping(base);
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  for (const g of ALL_GESTURES) {
    const entry = normalizeEntry(g, src[g]);
    if (entry) out[g] = entry;
  }
  out[LOCKED_GESTURE] = { ...LOCKED_ENTRY, params: {} };
  return out;
}

function getStorage(explicit?: Storage): Storage | null {
  if (explicit) return explicit;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readJson(s: Storage, key: string): unknown {
  try {
    const text = s.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* v1 (단일 매핑) — 마이그레이션 원본으로만 읽는다                     */
/* ------------------------------------------------------------------ */

/** 저장된 v1 매핑을 읽는다. 없음·파싱 실패·버전 불일치 → 기본값 */
export function loadMapping(storage?: Storage): Mapping {
  const s = getStorage(storage);
  if (!s) return cloneMapping(DEFAULT_MAPPING);
  const parsed = readJson(s, MAPPING_STORAGE_KEY) as Partial<StoredMapping> | null;
  if (!parsed || parsed.version !== MAPPING_VERSION) return cloneMapping(DEFAULT_MAPPING);
  return normalizeMapping(parsed.mapping);
}

/** v1 형식 저장 (테스트·호환용. 앱은 v2 를 쓴다) */
export function saveMapping(mapping: Mapping, storage?: Storage): void {
  const s = getStorage(storage);
  if (!s) return;
  const payload: StoredMapping = { version: MAPPING_VERSION, mapping: normalizeMapping(mapping) };
  try {
    s.setItem(MAPPING_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 저장 공간 부족·프라이빗 모드 등. 메모리 상태는 유지되므로 조용히 넘어간다
  }
}

export function clearMapping(storage?: Storage): void {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.removeItem(MAPPING_STORAGE_KEY);
  } catch {
    // 무시
  }
}

/* ------------------------------------------------------------------ */
/* v2 (모드별 매핑)                                                    */
/* ------------------------------------------------------------------ */

export const MAPPING_VERSION_V2 = 2 as const;
export const MAPPING_STORAGE_KEY_V2 = 'motion-shortcut.mapping.v2';

export type MappingByMode = Record<UserModeId, Mapping>;

export interface StoredMappingV2 {
  version: typeof MAPPING_VERSION_V2;
  byMode: MappingByMode;
}

function modeDefault(mode: UserModeId): Mapping {
  return cloneMapping(MODES[mode].defaultMapping ?? DEFAULT_MAPPING);
}

export function defaultByMode(): MappingByMode {
  const out = {} as MappingByMode;
  for (const m of MODE_ORDER) out[m] = modeDefault(m);
  return out;
}

/** 임의 입력 → 모드별 매핑. 빠진 모드는 그 모드 기본값, 항목은 normalizeMapping 규칙 */
export function normalizeByMode(input: unknown): MappingByMode {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out = {} as MappingByMode;
  for (const m of MODE_ORDER) out[m] = normalizeMapping(src[m], modeDefault(m));
  return out;
}

/**
 * 모드별 매핑을 읽는다.
 *  1) v2 가 있고 버전이 맞으면 정규화해 반환
 *  2) 없으면 v1 을 읽어 media 로 승격, 나머지 모드는 기본값. 결과를 v2 로 저장 (v1 은 지우지 않는다)
 *  3) 둘 다 없거나 손상 → 전부 기본값
 */
export function loadAll(storage?: Storage): MappingByMode {
  const s = getStorage(storage);
  if (!s) return defaultByMode();

  const v2 = readJson(s, MAPPING_STORAGE_KEY_V2) as Partial<StoredMappingV2> | null;
  if (v2 && v2.version === MAPPING_VERSION_V2) return normalizeByMode(v2.byMode);

  const v1 = readJson(s, MAPPING_STORAGE_KEY) as Partial<StoredMapping> | null;
  if (v1 && v1.version === MAPPING_VERSION && v1.mapping) {
    const migrated = defaultByMode();
    migrated.media = normalizeMapping(v1.mapping, DEFAULT_MAPPING);
    saveAll(migrated, s);
    return migrated;
  }
  return defaultByMode();
}

export function saveAll(byMode: MappingByMode, storage?: Storage): void {
  const s = getStorage(storage);
  if (!s) return;
  const payload: StoredMappingV2 = { version: MAPPING_VERSION_V2, byMode: normalizeByMode(byMode) };
  try {
    s.setItem(MAPPING_STORAGE_KEY_V2, JSON.stringify(payload));
  } catch {
    // 무시 (메모리 상태 유지)
  }
}

export function clearAll(storage?: Storage): void {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.removeItem(MAPPING_STORAGE_KEY_V2);
    s.removeItem(MAPPING_STORAGE_KEY);
  } catch {
    // 무시
  }
}

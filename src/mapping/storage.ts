import { isCommandId, validateParams } from '../commands/registry';
import { COMMANDS, defaultParams } from '../commands/catalog';
import { ALL_GESTURES, type GestureId } from '../gesture/types';
import { cloneMapping, DEFAULT_MAPPING } from './defaults';
import { LOCKED_ENTRY, LOCKED_GESTURE, MAPPING_STORAGE_KEY, MAPPING_VERSION, type Mapping, type MappingEntry, type StoredMapping } from './types';

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
 * 임의 입력 → 유효한 Mapping. 항목 단위로 검증해 못 쓰는 항목만 기본값으로 대체한다.
 * 주먹은 입력이 무엇이든 고정값으로 덮어쓴다 (안전장치).
 */
export function normalizeMapping(input: unknown): Mapping {
  const out = cloneMapping(DEFAULT_MAPPING);
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

/** 저장된 매핑을 읽는다. 없음·파싱 실패·버전 불일치 → 기본값 */
export function loadMapping(storage?: Storage): Mapping {
  const s = getStorage(storage);
  if (!s) return cloneMapping(DEFAULT_MAPPING);
  let text: string | null = null;
  try {
    text = s.getItem(MAPPING_STORAGE_KEY);
  } catch {
    return cloneMapping(DEFAULT_MAPPING);
  }
  if (!text) return cloneMapping(DEFAULT_MAPPING);
  try {
    const parsed = JSON.parse(text) as Partial<StoredMapping> | null;
    if (!parsed || parsed.version !== MAPPING_VERSION) return cloneMapping(DEFAULT_MAPPING);
    return normalizeMapping(parsed.mapping);
  } catch {
    return cloneMapping(DEFAULT_MAPPING);
  }
}

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

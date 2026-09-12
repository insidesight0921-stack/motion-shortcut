import { normalizeMapping } from '../mapping/storage';
import { LOCKED_ENTRY, LOCKED_GESTURE } from '../mapping/types';
import { createProfile, DEFAULT_PROFILE_NAME, defaultSettings, modeDefaultMapping } from './defaults';
import { migrateLegacyToProfileMapping, readLegacyByMode } from './migrate';
import {
  PRESENTATION_MODES,
  PROFILES_STORAGE_KEY,
  PROFILES_VERSION,
  PROGRAMS,
  type AssetSlot,
  type MappingByPresentationMode,
  type Profile,
  type ProfileSettings,
  type Program,
  type StoredProfiles,
} from './types';

/* ------------------------------------------------------------------ */
/* 정규화 (항목 단위 폴백, D-016 패턴)                                 */
/* ------------------------------------------------------------------ */

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeSettings(input: unknown): ProfileSettings {
  const d = defaultSettings();
  if (!input || typeof input !== 'object') return d;
  const s = input as Record<string, unknown>;
  const laser = (s.laser && typeof s.laser === 'object' ? s.laser : {}) as Record<string, unknown>;
  return {
    motionToggle: s.motionToggle === 'fist' ? 'fist' : 'x_cross',
    cursorSensitivity: num(s.cursorSensitivity, d.cursorSensitivity, 0.5, 3),
    cursorDeadzone: num(s.cursorDeadzone, d.cursorDeadzone, 0, 0.5),
    laser: {
      size: laser.size === 'sm' || laser.size === 'lg' ? laser.size : 'md',
      color: laser.color === 'red' ? 'red' : 'blue',
    },
    activeHand: s.activeHand === 'left' ? 'left' : 'right',
    voiceEnabled: s.voiceEnabled === true,
    agentPort: Math.round(num(s.agentPort, d.agentPort, 1024, 65535)),
  };
}

export function normalizeMappingByMode(input: unknown, program: Program): MappingByPresentationMode {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out = {} as MappingByPresentationMode;
  for (const m of PRESENTATION_MODES) out[m] = normalizeMapping(src[m], modeDefaultMapping(m, program));
  return out;
}

function normalizeAssets(input: unknown): AssetSlot[] {
  if (!Array.isArray(input)) return [];
  const out: AssetSlot[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    if (typeof a.id !== 'string' || typeof a.value !== 'string') continue;
    if (a.kind !== 'url' && a.kind !== 'file' && a.kind !== 'app') continue;
    out.push({
      id: a.id,
      kind: a.kind,
      value: a.value,
      label: typeof a.label === 'string' ? a.label : a.value,
      gesture: typeof a.gesture === 'string' ? (a.gesture as AssetSlot['gesture']) : null,
    });
  }
  return out;
}

/** 프로필 하나를 정규화. id 나 이름이 없으면 null (버린다) */
export function normalizeProfile(input: unknown, now: number = Date.now()): Profile | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id.length === 0) return null;
  const program: Program = PROGRAMS.includes(p.program as Program) ? (p.program as Program) : 'powerpoint';
  const rehearsal = p.rehearsal && typeof p.rehearsal === 'object' ? (p.rehearsal as Profile['rehearsal']) : undefined;
  const overrides = p.gestureOverrides && typeof p.gestureOverrides === 'object' ? (p.gestureOverrides as Profile['gestureOverrides']) : undefined;
  return {
    id: p.id,
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : DEFAULT_PROFILE_NAME,
    program,
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : now,
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : now,
    mappingByMode: normalizeMappingByMode(p.mappingByMode, program),
    assets: normalizeAssets(p.assets),
    rehearsal: rehearsal && rehearsal.version === 1 ? rehearsal : undefined,
    gestureOverrides: overrides,
    settings: normalizeSettings(p.settings),
  };
}

export function normalizeStored(input: unknown, now: number = Date.now()): StoredProfiles {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const profiles: Profile[] = [];
  const seen = new Set<string>();
  if (Array.isArray(src.profiles)) {
    for (const raw of src.profiles) {
      const p = normalizeProfile(raw, now);
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        profiles.push(p);
      }
    }
  }
  if (profiles.length === 0) profiles.push(createProfile(DEFAULT_PROFILE_NAME, 'powerpoint', now));
  const active = typeof src.activeProfileId === 'string' && seen.has(src.activeProfileId) ? src.activeProfileId : profiles[0].id;
  // 주먹 고정을 한 번 더 보장
  for (const p of profiles) for (const m of PRESENTATION_MODES) p.mappingByMode[m][LOCKED_GESTURE] = { ...LOCKED_ENTRY, params: {} };
  return { version: PROFILES_VERSION, activeProfileId: active, profiles };
}

/* ------------------------------------------------------------------ */
/* 읽기·쓰기                                                           */
/* ------------------------------------------------------------------ */

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

export interface LoadResult {
  stored: StoredProfiles;
  /** 옛 매핑에서 승격됐으면 true (UI 가 1회 안내) */
  migratedFromLegacy: boolean;
}

/**
 * 프로필을 읽는다.
 *  1) v3 → 정규화
 *  2) 없으면 v2/v1 매핑 → "기본 프로필"(PowerPoint) 하나로 승격해 v3 저장. 옛 키는 지우지 않는다
 *  3) 아무것도 없거나 손상 → 기본 프로필 하나
 */
export function loadProfiles(storage?: Storage, now: number = Date.now()): LoadResult {
  const s = getStorage(storage);
  if (!s) return { stored: normalizeStored(null, now), migratedFromLegacy: false };

  const v3 = readJson(s, PROFILES_STORAGE_KEY) as Partial<StoredProfiles> | null;
  if (v3 && v3.version === PROFILES_VERSION) return { stored: normalizeStored(v3, now), migratedFromLegacy: false };

  const legacy = readLegacyByMode(s);
  if (legacy) {
    const profile = createProfile(DEFAULT_PROFILE_NAME, 'powerpoint', now);
    profile.mappingByMode = migrateLegacyToProfileMapping(legacy, profile.program);
    const stored: StoredProfiles = { version: PROFILES_VERSION, activeProfileId: profile.id, profiles: [profile] };
    saveProfiles(stored, s);
    return { stored, migratedFromLegacy: true };
  }
  return { stored: normalizeStored(null, now), migratedFromLegacy: false };
}

export function saveProfiles(stored: StoredProfiles, storage?: Storage): void {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.setItem(PROFILES_STORAGE_KEY, JSON.stringify(normalizeStored(stored)));
  } catch {
    // 저장 실패는 조용히 (메모리 상태 유지)
  }
}

export function clearProfiles(storage?: Storage): void {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.removeItem(PROFILES_STORAGE_KEY);
  } catch {
    // 무시
  }
}

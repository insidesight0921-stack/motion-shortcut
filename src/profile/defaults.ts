import { cloneMapping, DEFAULT_MAPPING, emptyMapping } from '../mapping/defaults';
import { LOCKED_ENTRY, type Mapping } from '../mapping/types';
import {
  AGENT_PORT_DEFAULT,
  PRESENTATION_MODES,
  type MappingByPresentationMode,
  type PresentationModeId,
  type Profile,
  type ProfileSettings,
  type Program,
} from './types';

export const DEFAULT_PROFILE_NAME = '기본 프로필';

export function defaultSettings(): ProfileSettings {
  return {
    motionToggle: 'x_cross',
    cursorSensitivity: 1,
    cursorDeadzone: 0.15,
    laser: { size: 'md', color: 'blue' },
    activeHand: 'right',
    voiceEnabled: false,
    agentPort: AGENT_PORT_DEFAULT,
  };
}

/**
 * 슬라이드 모드 기본 매핑 (기획서 §13·§19). 프로그램별 키는 slide.* 명령이 실행 시점에 고른다.
 *  - 오른쪽 스와이프 → 다음, 왼쪽 스와이프 → 이전
 *  - 손바닥 → 화면 가리기(B, 다시 실행하면 복귀. 낮은 위험)
 *  - 원 → 발표 화면 복귀(Esc). 의도적 동작이라 높은 위험 명령에 배정
 *  - 주먹 → 고정 (settings.motionToggle === 'fist' 일 때만 동작)
 */
export function defaultSlideMapping(_program: Program): Mapping {
  const m = cloneMapping(DEFAULT_MAPPING);
  m.fist = { ...LOCKED_ENTRY, params: {} };
  return m;
}

/** 모드별 기본 매핑. cursor/laser/asset 은 2·3차에서 채우며 지금은 빈 프리셋 */
export function defaultMappingByMode(program: Program): MappingByPresentationMode {
  const out = {} as MappingByPresentationMode;
  for (const m of PRESENTATION_MODES) out[m] = m === 'slide' ? defaultSlideMapping(program) : emptyMapping();
  return out;
}

export function modeDefaultMapping(mode: PresentationModeId, program: Program): Mapping {
  return mode === 'slide' ? defaultSlideMapping(program) : emptyMapping();
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createProfile(name: string, program: Program, now: number = Date.now()): Profile {
  return {
    id: newId(),
    name: name.trim() || DEFAULT_PROFILE_NAME,
    program,
    createdAt: now,
    updatedAt: now,
    mappingByMode: defaultMappingByMode(program),
    assets: [],
    settings: defaultSettings(),
  };
}

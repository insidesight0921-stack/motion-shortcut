import type { GestureId } from '../gesture/types';
import type { Mapping } from '../mapping/types';

/**
 * 발표 프로필 (기획서 §19·§21, D-017).
 * 프로필 = 발표 이름 + 프로그램 + 모드별 매핑 + 자료 슬롯 + 리허설 통계 + 설정.
 * 리허설은 좌표 원본이 아니라 통계만 저장하고, 프로필을 지우면 함께 사라진다 (§18).
 */
export type Program = 'powerpoint' | 'keynote' | 'google-slides';
export const PROGRAMS: Program[] = ['powerpoint', 'keynote', 'google-slides'];
export const PROGRAM_LABEL: Record<Program, string> = {
  powerpoint: 'PowerPoint',
  keynote: 'Keynote',
  'google-slides': 'Google Slides',
};

/** 발표 제어 모드 (standby 제외). modes/types.ts 의 UserModeId 가 1-2 에서 이 목록을 가져다 쓴다 */
export const PRESENTATION_MODES = ['slide', 'cursor', 'laser', 'asset'] as const;
export type PresentationModeId = (typeof PRESENTATION_MODES)[number];

export type MappingByPresentationMode = Record<PresentationModeId, Mapping>;

/** 모션 ON/OFF(= standby 토글) 제스처. 기본은 양손 X 유지, 주먹은 대안 */
export type MotionToggle = 'x_cross' | 'fist';

export interface LaserSettings {
  size: 'sm' | 'md' | 'lg';
  color: 'blue' | 'red';
}

export interface ProfileSettings {
  motionToggle: MotionToggle;
  /** 커서 민감도 0.5~3 */
  cursorSensitivity: number;
  /** 데드존 (손 크기 배수) 0~0.5 */
  cursorDeadzone: number;
  laser: LaserSettings;
  /** 커서·레이저를 움직이는 손 */
  activeHand: 'right' | 'left';
  /** 음성 모드 전환 (실험 기능, 기본 꺼짐) */
  voiceEnabled: boolean;
  /** 로컬 에이전트 WebSocket 포트 */
  agentPort: number;
}

/** 자료 슬롯 (3차에서 채움). 타입만 먼저 둔다 */
export interface AssetSlot {
  id: string;
  kind: 'url' | 'file' | 'app';
  value: string;
  label: string;
  /** 실행 제스처. null 이면 슬롯만 등록된 상태 */
  gesture: GestureId | null;
}

/** 리허설 통계 (4차에서 채움). 좌표 원본은 넣지 않는다 (§18) */
export interface RehearsalStats {
  version: 1;
  recordedAt: number;
  durationMs: number;
  /** 항목별 수치. 4차에서 구체 타입으로 좁힌다 */
  summary: Record<string, number>;
}

/** "주의" 제스처에 붙는 추가 조건 (4차) */
export interface GestureOverride {
  holdMs?: number;
  cooldownMs?: number;
  minTravel?: number;
  minHeight?: number;
}

export interface Profile {
  id: string;
  name: string;
  program: Program;
  createdAt: number;
  updatedAt: number;
  mappingByMode: MappingByPresentationMode;
  assets: AssetSlot[];
  rehearsal?: RehearsalStats;
  gestureOverrides?: Partial<Record<GestureId, GestureOverride>>;
  settings: ProfileSettings;
}

export const PROFILES_VERSION = 3 as const;
export const PROFILES_STORAGE_KEY = 'motion-shortcut.profiles.v3';

export interface StoredProfiles {
  version: typeof PROFILES_VERSION;
  activeProfileId: string | null;
  profiles: Profile[];
}

export const AGENT_PORT_DEFAULT = 41777;

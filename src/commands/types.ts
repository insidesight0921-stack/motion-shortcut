/**
 * 명령 계층 타입. 제스처 인식(gesture/)과 발표 제어를 잇는 얇은 인터페이스.
 * 명령은 프로필의 모드별 매핑에서 제스처에 연결된다. 실행 출구는 agent/dispatch.ts (에이전트 우선, 페이지 폴백).
 */
export type CommandId =
  | 'slide.next'
  | 'slide.prev'
  | 'slide.first'
  | 'slide.goto'
  | 'slide.start'
  | 'slide.blackout'
  | 'slide.return'
  | 'key.press'
  | 'none'
  | 'system.toggleEnabled';

export const ALL_COMMAND_IDS: CommandId[] = [
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

/** 명령이 받는 파라미터의 형태. 매핑 편집기가 이 스키마로 입력 UI를 그린다. */
export type ParamSchema =
  | { kind: 'none' }
  | {
      kind: 'number';
      key: 'seconds' | 'minutes' | 'slide';
      label: string;
      unit: string;
      min: number;
      max: number;
      step: number;
      default: number;
    }
  | { kind: 'keyCombo'; key: 'combo'; label: string; default: string };

export type CommandParams = Record<string, number | string>;

export interface CommandContext {
  /** Date.now() 기준 ms */
  now: number;
  /** system.toggleEnabled 용. 실제 토글은 엔진이 하므로 명령은 보통 호출하지 않는다 (D-015) */
  toggleEnabled: () => void;
}

export interface CommandResult {
  /** false = 실행 실패. 로그에 "실행 실패 · 사유"로 남는다 */
  ok: boolean;
  message: string;
}

/** 기획서 §16 명령별 안전 수준 */
export type RiskLevel = 'low' | 'medium' | 'high';

export interface CommandDef {
  id: CommandId;
  /** 드롭다운 표시명 */
  name: string;
  /** 도움말. 한계가 있으면 여기 적는다 */
  description: string;
  params: ParamSchema;
  /** false면 매핑 편집기 드롭다운에 노출하지 않는다 (system.toggleEnabled) */
  assignable: boolean;
  risk: RiskLevel;
  run(params: CommandParams, ctx: CommandContext): CommandResult;
}

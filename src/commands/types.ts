import type { GestureId } from '../gesture/types';

/**
 * 명령 계층. 제스처 인식과 화면 기능을 잇는 얇은 인터페이스.
 * 다른 모드(운동, 발표 등)는 만들지 않지만 Mode 인터페이스가 확장 지점이다.
 */
export type CommandId = 'video.toggle' | 'recipe.next' | 'recipe.prev' | 'timer.toggle';

export interface CommandContext {
  /** Date.now() 기준 ms. 타이머 등 벽시계가 필요한 명령용 */
  now: number;
}

export interface CommandResult {
  /** false면 명령은 호출됐지만 할 일이 없었다(예: 이미 마지막 단계). 로그에 사유를 남긴다 */
  ok: boolean;
  message: string;
}

export interface Command {
  id: CommandId;
  label: string;
  run(ctx: CommandContext): CommandResult;
}

export interface Mode {
  id: string;
  name: string;
  /** 제스처 → 명령. 매핑되지 않은 제스처(fist)는 모드 밖에서 처리된다 */
  mapping: Partial<Record<GestureId, CommandId>>;
  commands: Record<CommandId, Command>;
}

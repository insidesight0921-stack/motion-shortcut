import type { GestureId } from '../gesture/types';
import type { Command, CommandContext, CommandResult, Mode } from './types';

export interface Execution {
  command: Command;
  result: CommandResult;
}

/** 제스처에 매핑된 명령을 찾는다. 없으면 null (예: fist는 모드 밖 토글). */
export function resolveCommand(mode: Mode, gesture: GestureId): Command | null {
  const id = mode.mapping[gesture];
  return id ? mode.commands[id] : null;
}

/** 제스처에 매핑된 명령을 실행한다. 매핑이 없으면 null. */
export function runGesture(mode: Mode, gesture: GestureId, ctx: CommandContext): Execution | null {
  const command = resolveCommand(mode, gesture);
  if (!command) return null;
  return { command, result: command.run(ctx) };
}

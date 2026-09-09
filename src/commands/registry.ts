import type { GestureId } from '../gesture/types';
import type { Mapping, MappingEntry } from '../mapping/types';
import { COMMANDS } from './catalog';
import { parseKeyCombo } from './keyPress';
import type { CommandContext, CommandDef, CommandId, CommandParams, CommandResult } from './types';

export type ValidationResult = { ok: true; params: CommandParams } | { ok: false; error: string };

export function isCommandId(id: unknown): id is CommandId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(COMMANDS, id);
}

export function getCommand(id: CommandId): CommandDef {
  return COMMANDS[id];
}

/**
 * 파라미터 검증. 스키마에 없는 키는 거부하고, 숫자는 범위·정수(step 1)·유한성을 본다.
 * 통과하면 정규화된 값(숫자는 Number, 조합은 trim)을 돌려준다.
 */
export function validateParams(def: CommandDef, params: CommandParams): ValidationResult {
  const schema = def.params;
  const keys = Object.keys(params ?? {});

  if (schema.kind === 'none') {
    if (keys.length > 0) return { ok: false, error: `${def.name}은(는) 파라미터를 받지 않음: ${keys.join(', ')}` };
    return { ok: true, params: {} };
  }

  const extra = keys.filter((k) => k !== schema.key);
  if (extra.length > 0) return { ok: false, error: `알 수 없는 파라미터: ${extra.join(', ')}` };

  const raw = params[schema.key];
  if (raw === undefined || raw === null || raw === '') return { ok: false, error: `${schema.label}이(가) 비어 있음` };

  if (schema.kind === 'number') {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: `${schema.label}은(는) 숫자여야 함` };
    if (schema.step === 1 && !Number.isInteger(n)) return { ok: false, error: `${schema.label}은(는) 정수여야 함` };
    if (n < schema.min || n > schema.max) return { ok: false, error: `${schema.label}은(는) ${schema.min}~${schema.max}${schema.unit} 사이여야 함` };
    return { ok: true, params: { [schema.key]: n } };
  }

  // keyCombo
  const text = String(raw).trim();
  if (!parseKeyCombo(text)) return { ok: false, error: `키 조합 형식이 아님: "${text}"` };
  return { ok: true, params: { [schema.key]: text } };
}

/** id로 명령을 실행한다. 알 수 없는 id·검증 실패는 ok:false 로 돌려준다(throw 하지 않음) */
export function runCommand(id: CommandId | string, params: CommandParams, ctx: CommandContext): CommandResult {
  if (!isCommandId(id)) return { ok: false, message: `알 수 없는 명령: ${String(id)}` };
  const def = COMMANDS[id];
  const v = validateParams(def, params);
  if (!v.ok) return { ok: false, message: v.error };
  try {
    return def.run(v.params, ctx);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export type ExecutionStatus = 'executed' | 'failed' | 'ignored';

export interface Execution {
  gesture: GestureId;
  entry: MappingEntry;
  def: CommandDef | null;
  status: ExecutionStatus;
  message: string;
}

export interface RunMappingOptions {
  /** 키 캡처 중 등 매핑 실행을 잠시 멈춰야 할 때 true (보완 1) */
  paused?: boolean;
  pausedReason?: string;
}

/**
 * 제스처에 매핑된 명령을 실행한다.
 *  - paused → ignored (사유: pausedReason 또는 "일시 중지")
 *  - 매핑 없음 / none → ignored
 *  - 명령이 ok:false → failed
 */
export function runMapping(mapping: Mapping, gesture: GestureId, ctx: CommandContext, opts: RunMappingOptions = {}): Execution {
  const entry = mapping[gesture];
  const def = entry && isCommandId(entry.commandId) ? COMMANDS[entry.commandId] : null;

  if (opts.paused) {
    return { gesture, entry, def, status: 'ignored', message: opts.pausedReason ?? '일시 중지' };
  }
  if (!entry || !def) {
    return { gesture, entry, def: null, status: 'ignored', message: '매핑된 명령 없음' };
  }
  if (def.id === 'none') {
    return { gesture, entry, def, status: 'ignored', message: '명령 없음' };
  }
  const result = runCommand(def.id, entry.params, ctx);
  return { gesture, entry, def, status: result.ok ? 'executed' : 'failed', message: result.message };
}

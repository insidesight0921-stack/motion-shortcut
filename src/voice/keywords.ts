import { MODES } from '../modes/catalog';
import { MODE_ORDER, type UserModeId } from '../modes/types';

/**
 * 발화 → 의도. 순수 함수. 음성은 모드 전환과 대기 진입/해제에만 쓴다 (명령 실행 없음).
 *
 * 매칭 규칙 (보완 1):
 *  - "모드"가 들어간 별칭("발표 모드")은 정규화 후 **포함** 매칭. 한국어는 "발표 모드로 바꿔줘"처럼
 *    조사·서술어가 붙는 것이 기본형이라 완전 일치는 실기에서 전부 실패한다.
 *  - 단독 단어("발표")는 정규화 후 **완전 일치**만. 그리고 대기 모드가 아닐 때만 인정한다(오인식 방지).
 *  - 대기 진입/해제 별칭은 완전 일치. 해제("깨어나")는 대기 중에도 당연히 허용.
 */
export type Intent = { kind: 'switch'; mode: UserModeId } | { kind: 'standby' } | { kind: 'wake' };

export interface MatchResult {
  intent: Intent;
  /** 매칭된 별칭(원문) */
  alias: string;
  /** 매칭된 발화(원문) */
  utterance: string;
}

export const STANDBY_ALIASES = ['대기 모드', '대기', '잠금', '쉬어', '잠깐 멈춰', '멈춰'];
export const WAKE_ALIASES = ['깨어나', '시작', '다시 시작', '일어나', '깨워'];

/** 공백·문장부호 제거, 소문자 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[.,!?~…·"'“”‘’()\[\]{}<>\-_/\\:;]/g, '');
}

interface Rule {
  intent: Intent;
  alias: string;
  norm: string;
  /** 포함 매칭 여부 ("모드"가 들어간 별칭) */
  contains: boolean;
  /** 대기 중에도 허용되는가 */
  allowedInStandby: boolean;
}

function buildRules(): Rule[] {
  const rules: Rule[] = [];
  for (const id of MODE_ORDER) {
    for (const alias of MODES[id].voiceAliases) {
      const contains = alias.includes('모드');
      rules.push({ intent: { kind: 'switch', mode: id }, alias, norm: normalize(alias), contains, allowedInStandby: contains });
    }
  }
  for (const alias of STANDBY_ALIASES) {
    const contains = alias.includes('모드');
    rules.push({ intent: { kind: 'standby' }, alias, norm: normalize(alias), contains, allowedInStandby: false });
  }
  for (const alias of WAKE_ALIASES) {
    rules.push({ intent: { kind: 'wake' }, alias, norm: normalize(alias), contains: false, allowedInStandby: true });
  }
  // 긴 별칭 먼저: "미디어 모드" 가 "미디어" 보다 앞에 와야 한다
  rules.sort((a, b) => b.norm.length - a.norm.length);
  return rules;
}

let RULES: Rule[] | null = null;
function rules(): Rule[] {
  if (!RULES) RULES = buildRules();
  return RULES;
}

function matchOne(utterance: string, inStandby: boolean): MatchResult | null {
  const norm = normalize(utterance);
  if (!norm) return null;
  for (const r of rules()) {
    if (inStandby && !r.allowedInStandby) continue;
    const hit = r.contains ? norm.includes(r.norm) : norm === r.norm;
    if (hit) return { intent: r.intent, alias: r.alias, utterance };
  }
  return null;
}

/**
 * 인식 대안(최대 3개)을 순서대로 검사해 첫 매칭을 돌려준다. 없으면 null.
 * 대기 중(ctx.inStandby)에는 "모드"가 붙은 전환 별칭과 해제 별칭만 인정한다.
 */
export function match(alternatives: string[], ctx: { inStandby: boolean }): MatchResult | null {
  for (const alt of alternatives) {
    const r = matchOne(alt, ctx.inStandby);
    if (r) return r;
  }
  return null;
}

export function describeIntent(intent: Intent): string {
  switch (intent.kind) {
    case 'switch':
      return `switch:${intent.mode}`;
    case 'standby':
      return 'standby';
    case 'wake':
      return 'wake';
  }
}

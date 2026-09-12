import { currentPlatform, sendKeyCombo, sendKeySequence, viaLabel } from '../agent/dispatch';
import { currentProgram } from './programProvider';
import { detectPlatform, GOTO_MAX, GOTO_MIN, SLIDE_ACTION_LABEL, slideKeyCombos, type SlideAction } from './programs';
import type { CommandDef, CommandId, CommandParams, CommandResult } from './types';

/** 슬라이드 명령 공통: 활성 프로필의 프로그램 + 현재 플랫폼 → 키 조합 → 실행 출구 */
function runSlide(action: SlideAction, n?: number): CommandResult {
  const program = currentProgram();
  const platform = detectPlatform(currentPlatform());
  let combos: string[];
  try {
    combos = slideKeyCombos(program, platform, action, n);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  const r = sendKeySequence(combos);
  if (!r.ok) return r;
  const keys = combos.join(' ');
  return { ok: true, message: `${SLIDE_ACTION_LABEL[action]} (${keys}) · ${viaLabel(r.via)}` };
}

function slideDef(action: SlideAction, id: CommandId, risk: CommandDef['risk'], description: string): CommandDef {
  return {
    id,
    name: SLIDE_ACTION_LABEL[action],
    description,
    params: { kind: 'none' },
    assignable: true,
    risk,
    run: () => runSlide(action),
  };
}

/**
 * 명령 카탈로그 (D-017). 순서가 매핑 편집기 드롭다운 순서다.
 * 파라미터는 registry.validateParams 를 통과한 값이 들어온다고 가정한다.
 */
export const COMMANDS: Record<CommandId, CommandDef> = {
  'slide.next': slideDef('next', 'slide.next', 'low', '다음 슬라이드로 넘깁니다 (→).'),
  'slide.prev': slideDef('prev', 'slide.prev', 'low', '이전 슬라이드로 돌아갑니다 (←).'),
  'slide.first': slideDef('first', 'slide.first', 'low', '첫 슬라이드로 이동합니다 (Home).'),
  'slide.goto': {
    id: 'slide.goto',
    name: SLIDE_ACTION_LABEL.goto,
    description: '지정한 번호의 슬라이드로 이동합니다 (번호 + Enter). 프로그램 버전에 따라 다를 수 있습니다.',
    params: { kind: 'number', key: 'slide', label: '슬라이드 번호', unit: '번', min: GOTO_MIN, max: GOTO_MAX, step: 1, default: 1 },
    assignable: true,
    risk: 'low',
    run: (params) => runSlide('goto', Number(params.slide)),
  },
  'slide.start': slideDef('start', 'slide.start', 'medium', '발표(슬라이드 쇼)를 시작합니다. 프로그램별 단축키를 보냅니다.'),
  'slide.blackout': slideDef('blackout', 'slide.blackout', 'low', '발표 화면을 검게 가립니다. 한 번 더 실행하면 돌아옵니다 (B).'),
  'slide.return': slideDef('return', 'slide.return', 'high', '발표 화면으로 복귀합니다 (Esc). 발표 프로그램에 따라 슬라이드 쇼가 끝날 수 있어 의도적인 제스처에 두세요.'),
  'key.press': {
    id: 'key.press',
    name: '키 입력',
    description:
      '키 조합을 보냅니다. 에이전트가 연결돼 있으면 포커스된 앱에 실제 키 입력으로, 아니면 이 페이지 안에서만 동작하는 합성 이벤트(isTrusted=false)로 보냅니다.',
    params: { kind: 'keyCombo', key: 'combo', label: '키 조합', default: 'ArrowRight' },
    assignable: true,
    risk: 'medium',
    run: (params) => {
      const r = sendKeyCombo(String(params.combo));
      return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.message };
    },
  },
  none: {
    id: 'none',
    name: '없음',
    description: '아무것도 하지 않습니다.',
    params: { kind: 'none' },
    assignable: true,
    risk: 'low',
    run: () => ({ ok: true, message: '명령 없음' }),
  },
  'system.toggleEnabled': {
    id: 'system.toggleEnabled',
    name: '활성화 on/off (주먹)',
    description: '주먹 유지로 활성화를 켜고 끕니다. 프로필 설정의 모션 토글이 "주먹"일 때만 동작하며, 실제 토글은 인식 엔진이 수행합니다.',
    params: { kind: 'none' },
    assignable: false,
    risk: 'medium',
    // 엔진이 이미 토글한 뒤 호출되므로 여기서는 상태를 바꾸지 않는다 (D-015 결정 1)
    run: () => ({ ok: true, message: '활성화 토글' }),
  },
};

export const ASSIGNABLE_COMMANDS: CommandDef[] = Object.values(COMMANDS).filter((c) => c.assignable);

/** 스키마의 기본 파라미터 */
export function defaultParams(def: CommandDef): CommandParams {
  switch (def.params.kind) {
    case 'none':
      return {};
    case 'number':
      return { [def.params.key]: def.params.default };
    case 'keyCombo':
      return { [def.params.key]: def.params.default };
  }
}

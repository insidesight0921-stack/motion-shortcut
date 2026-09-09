import { useTargetStore } from '../store/targetStore';
import { dispatchKeyCombo, parseKeyCombo } from './keyPress';
import type { CommandDef, CommandId, CommandParams } from './types';

const PLAYER_NOT_READY = '플레이어 준비 안 됨';

function player() {
  const { playerApi, playerReady } = useTargetStore.getState();
  return playerApi && playerReady ? playerApi : null;
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/**
 * 범용 명령 카탈로그. 순서가 매핑 편집기 드롭다운 순서다.
 * 파라미터는 registry.validateParams 를 통과한 값이 들어온다고 가정한다.
 */
export const COMMANDS: Record<CommandId, CommandDef> = {
  'media.playPause': {
    id: 'media.playPause',
    name: '재생/일시정지',
    description: '페이지의 YouTube 플레이어를 재생하거나 멈춥니다.',
    params: { kind: 'none' },
    assignable: true,
    run: () => {
      const p = player();
      if (!p) return { ok: false, message: PLAYER_NOT_READY };
      const state = p.getState();
      if (state === 'playing' || state === 'buffering') {
        p.pause();
        return { ok: true, message: '일시정지' };
      }
      p.play();
      return { ok: true, message: '재생' };
    },
  },
  'media.seekForward': {
    id: 'media.seekForward',
    name: '앞으로 이동',
    description: '재생 위치를 지정한 초만큼 앞으로 옮깁니다.',
    params: { kind: 'number', key: 'seconds', label: '이동량', unit: '초', min: 1, max: 600, step: 1, default: 10 },
    assignable: true,
    run: (params) => {
      const p = player();
      if (!p) return { ok: false, message: PLAYER_NOT_READY };
      const n = Number(params.seconds);
      const target = Math.min(p.getDuration() || Infinity, p.getCurrentTime() + n);
      p.seekTo(target);
      return { ok: true, message: `+${n}초 → ${fmtTime(target)}` };
    },
  },
  'media.seekBackward': {
    id: 'media.seekBackward',
    name: '뒤로 이동',
    description: '재생 위치를 지정한 초만큼 뒤로 옮깁니다.',
    params: { kind: 'number', key: 'seconds', label: '이동량', unit: '초', min: 1, max: 600, step: 1, default: 10 },
    assignable: true,
    run: (params) => {
      const p = player();
      if (!p) return { ok: false, message: PLAYER_NOT_READY };
      const n = Number(params.seconds);
      const target = Math.max(0, p.getCurrentTime() - n);
      p.seekTo(target);
      return { ok: true, message: `−${n}초 → ${fmtTime(target)}` };
    },
  },
  'timer.toggle': {
    id: 'timer.toggle',
    name: '타이머 시작/정지',
    description: '지정한 분의 카운트다운을 시작합니다. 실행 중이면 멈춥니다.',
    params: { kind: 'number', key: 'minutes', label: '시간', unit: '분', min: 1, max: 180, step: 1, default: 3 },
    assignable: true,
    run: (params, ctx) => {
      const minutes = Number(params.minutes);
      const what = useTargetStore.getState().toggleTimer(ctx.now, minutes * 60_000);
      return { ok: true, message: what === 'started' ? `${minutes}분 타이머 시작` : '타이머 정지' };
    },
  },
  'key.press': {
    id: 'key.press',
    name: '키 입력',
    description:
      '이 페이지에 키보드 이벤트를 합성해 보냅니다. 스크립트가 만든 이벤트(isTrusted=false)라 YouTube 플레이어 같은 외부 콘텐츠나 브라우저 기본 동작에는 전달되지 않고, 이 페이지 안의 리스너에만 동작합니다.',
    params: { kind: 'keyCombo', key: 'combo', label: '키 조합', default: 'ArrowRight' },
    assignable: true,
    run: (params) => {
      const combo = parseKeyCombo(String(params.combo));
      if (!combo) return { ok: false, message: `키 조합을 해석할 수 없음: ${String(params.combo)}` };
      if (typeof document === 'undefined') return { ok: false, message: 'DOM 없음' };
      dispatchKeyCombo(combo);
      return { ok: true, message: `${String(params.combo)} 입력 (합성 이벤트)` };
    },
  },
  none: {
    id: 'none',
    name: '없음',
    description: '아무것도 하지 않습니다.',
    params: { kind: 'none' },
    assignable: true,
    run: () => ({ ok: true, message: '명령 없음' }),
  },
  'system.toggleEnabled': {
    id: 'system.toggleEnabled',
    name: '활성화 on/off',
    description: '모션 단축키를 켜고 끕니다. 주먹 제스처에 고정되어 있으며, 실제 토글은 인식 엔진이 수행합니다.',
    params: { kind: 'none' },
    assignable: false,
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

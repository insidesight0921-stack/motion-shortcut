import { LOCKED_ENTRY, type Mapping } from './types';

/** 기본 매핑. 손바닥→재생/일시정지, 오른쪽→+10초, 왼쪽→−10초, 원→3분 타이머, 주먹→활성화(고정) */
export const DEFAULT_MAPPING: Mapping = {
  open_palm: { commandId: 'media.playPause', params: {} },
  swipe_right: { commandId: 'media.seekForward', params: { seconds: 10 } },
  swipe_left: { commandId: 'media.seekBackward', params: { seconds: 10 } },
  circle: { commandId: 'timer.toggle', params: { minutes: 3 } },
  fist: LOCKED_ENTRY,
};

/** 빈 프리셋: 주먹만 고정, 나머지는 none */
export function emptyMapping(): Mapping {
  return {
    open_palm: { commandId: 'none', params: {} },
    swipe_right: { commandId: 'none', params: {} },
    swipe_left: { commandId: 'none', params: {} },
    circle: { commandId: 'none', params: {} },
    fist: { ...LOCKED_ENTRY, params: {} },
  };
}

/** 매핑에 none 이 아닌 명령이 하나라도 있는가 (빈 프리셋 판단) */
export function hasAnyCommand(m: Mapping): boolean {
  return (Object.keys(m) as (keyof Mapping)[]).some((g) => g !== 'fist' && m[g].commandId !== 'none');
}

export function cloneMapping(m: Mapping): Mapping {
  const out = {} as Mapping;
  for (const k of Object.keys(m) as (keyof Mapping)[]) {
    out[k] = { commandId: m[k].commandId, params: { ...m[k].params } };
  }
  return out;
}

import { LOCKED_ENTRY, type Mapping } from './types';

/** 기본 매핑. 손바닥→재생/일시정지, 오른쪽→+10초, 왼쪽→−10초, 원→3분 타이머, 주먹→활성화(고정) */
export const DEFAULT_MAPPING: Mapping = {
  open_palm: { commandId: 'media.playPause', params: {} },
  swipe_right: { commandId: 'media.seekForward', params: { seconds: 10 } },
  swipe_left: { commandId: 'media.seekBackward', params: { seconds: 10 } },
  circle: { commandId: 'timer.toggle', params: { minutes: 3 } },
  fist: LOCKED_ENTRY,
};

export function cloneMapping(m: Mapping): Mapping {
  const out = {} as Mapping;
  for (const k of Object.keys(m) as (keyof Mapping)[]) {
    out[k] = { commandId: m[k].commandId, params: { ...m[k].params } };
  }
  return out;
}

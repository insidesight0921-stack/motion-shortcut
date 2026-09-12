import { LOCKED_ENTRY, type Mapping } from './types';

/**
 * 기본 매핑 = 슬라이드 모드 기본값 (기획서 §13·§19, D-017).
 * 오른쪽 스와이프→다음, 왼쪽→이전, 손바닥→화면 가리기(B), 원→발표 화면 복귀(Esc), 주먹→활성화(고정).
 * 정규화 폴백의 기본 base 로도 쓰인다.
 */
export const DEFAULT_MAPPING: Mapping = {
  open_palm: { commandId: 'slide.blackout', params: {} },
  swipe_right: { commandId: 'slide.next', params: {} },
  swipe_left: { commandId: 'slide.prev', params: {} },
  circle: { commandId: 'slide.return', params: {} },
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

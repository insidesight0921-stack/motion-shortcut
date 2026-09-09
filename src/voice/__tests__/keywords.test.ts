import { describe, expect, it } from 'vitest';
import { MODES } from '../../modes/catalog';
import { MODE_ORDER } from '../../modes/types';
import { describeIntent, match, normalize, STANDBY_ALIASES, WAKE_ALIASES } from '../keywords';

const active = { inStandby: false };
const standby = { inStandby: true };

describe('normalize', () => {
  it('공백·문장부호 제거, 소문자', () => {
    expect(normalize('발표 모드.')).toBe('발표모드');
    expect(normalize('  Media  Mode! ')).toBe('mediamode');
    expect(normalize('잠깐, 멈춰~')).toBe('잠깐멈춰');
  });
});

describe('별칭 전부 매칭', () => {
  it('모드 4개의 모든 별칭이 해당 모드로 매칭된다 (활성 상태)', () => {
    for (const id of MODE_ORDER) {
      for (const alias of MODES[id].voiceAliases) {
        const r = match([alias], active);
        expect(r, alias).not.toBeNull();
        expect(describeIntent(r!.intent)).toBe(`switch:${id}`);
      }
    }
  });

  it('대기·해제 별칭', () => {
    for (const a of STANDBY_ALIASES) expect(describeIntent(match([a], active)!.intent), a).toBe('standby');
    for (const a of WAKE_ALIASES) expect(describeIntent(match([a], standby)!.intent), a).toBe('wake');
  });
});

describe('한국어 발화 변형 (보완 1)', () => {
  it('띄어쓰기 변형 "발표모드"', () => {
    expect(describeIntent(match(['발표모드'], active)!.intent)).toBe('switch:presentation');
  });

  it('조사·서술어가 붙은 "발표 모드로 바꿔줘"는 포함 매칭으로 통과', () => {
    expect(describeIntent(match(['발표 모드로 바꿔줘'], active)!.intent)).toBe('switch:presentation');
    expect(describeIntent(match(['미디어 모드로 가자'], active)!.intent)).toBe('switch:media');
    expect(describeIntent(match(['지금부터 회의 모드'], active)!.intent)).toBe('switch:meeting');
  });

  it('단독 단어가 문장 속에 있으면 매칭하지 않는다: "발표 준비해"', () => {
    expect(match(['발표 준비해'], active)).toBeNull();
    expect(match(['영상 하나 틀어줘'], active)).toBeNull();
  });

  it('단독 단어는 완전 일치만: "발표", "발표."', () => {
    expect(describeIntent(match(['발표'], active)!.intent)).toBe('switch:presentation');
    expect(describeIntent(match(['발표.'], active)!.intent)).toBe('switch:presentation');
  });

  it('긴 별칭 우선: "미디어 모드"는 media 로, 부분 문자열 "미디어"에 잡히지 않는다', () => {
    const r = match(['미디어 모드'], active)!;
    expect(r.alias).toBe('미디어 모드');
  });
});

describe('대안 3개', () => {
  it('첫 번째가 틀리고 두 번째가 맞으면 두 번째를 채택', () => {
    const r = match(['발표 준비해', '발표 모드', '발포 모드'], active)!;
    expect(r).not.toBeNull();
    expect(describeIntent(r.intent)).toBe('switch:presentation');
    expect(r.utterance).toBe('발표 모드');
  });

  it('셋 다 틀리면 null', () => {
    expect(match(['안녕하세요', '오늘 날씨', '음'], active)).toBeNull();
  });
});

describe('대기 모드 규칙', () => {
  it('대기 중 단독 단어("발표")는 거부, "발표 모드"는 허용', () => {
    expect(match(['발표'], standby)).toBeNull();
    expect(describeIntent(match(['발표 모드'], standby)!.intent)).toBe('switch:presentation');
  });

  it('대기 중 해제 별칭은 허용, 대기 진입 별칭은 무시', () => {
    expect(describeIntent(match(['깨어나'], standby)!.intent)).toBe('wake');
    expect(describeIntent(match(['다시 시작'], standby)!.intent)).toBe('wake');
    expect(match(['대기'], standby)).toBeNull();
  });

  it('활성 상태에서 "시작"은 wake 로 해석되지만 호출자가 무시할 수 있도록 intent 만 준다', () => {
    expect(describeIntent(match(['시작'], active)!.intent)).toBe('wake');
  });
});

describe('빈 입력', () => {
  it('빈 문자열·공백만이면 null', () => {
    expect(match([''], active)).toBeNull();
    expect(match(['   '], active)).toBeNull();
    expect(match([], active)).toBeNull();
  });
});

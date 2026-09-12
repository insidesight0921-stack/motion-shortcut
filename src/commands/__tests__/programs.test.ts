import { describe, expect, it } from 'vitest';
import { PROGRAMS } from '../../profile/types';
import { parseKeyCombo } from '../keyPress';
import { detectPlatform, GOTO_MAX, GOTO_MIN, SLIDE_ACTIONS, slideKeyCombos, type Platform } from '../programs';

const PLATFORMS: Platform[] = ['darwin', 'win32'];

describe('발표 프로그램 단축키 표', () => {
  it('3개 프로그램 × 2개 플랫폼 × 7개 동작이 모두 정의되어 있고 파싱 가능한 조합이다', () => {
    for (const program of PROGRAMS) {
      for (const platform of PLATFORMS) {
        for (const action of SLIDE_ACTIONS) {
          const combos = slideKeyCombos(program, platform, action, 3);
          expect(combos.length, `${program}/${platform}/${action}`).toBeGreaterThan(0);
          for (const c of combos) expect(parseKeyCombo(c), `${program}/${platform}/${action}: ${c}`).not.toBeNull();
        }
      }
    }
  });

  it('공통 키: 다음 →, 이전 ←, 첫 Home, 가리기 B, 복귀 Esc', () => {
    for (const program of PROGRAMS) {
      for (const platform of PLATFORMS) {
        expect(slideKeyCombos(program, platform, 'next')).toEqual(['ArrowRight']);
        expect(slideKeyCombos(program, platform, 'prev')).toEqual(['ArrowLeft']);
        expect(slideKeyCombos(program, platform, 'first')).toEqual(['Home']);
        expect(slideKeyCombos(program, platform, 'blackout')).toEqual(['B']);
        expect(slideKeyCombos(program, platform, 'return')).toEqual(['Escape']);
      }
    }
  });

  it('발표 시작은 프로그램·플랫폼별로 다르다', () => {
    expect(slideKeyCombos('powerpoint', 'darwin', 'start')).toEqual(['Shift+Meta+Enter']);
    expect(slideKeyCombos('powerpoint', 'win32', 'start')).toEqual(['F5']);
    expect(slideKeyCombos('keynote', 'darwin', 'start')).toEqual(['Alt+Meta+P']);
    expect(slideKeyCombos('google-slides', 'darwin', 'start')).toEqual(['Meta+Enter']);
    expect(slideKeyCombos('google-slides', 'win32', 'start')).toEqual(['Ctrl+F5']);
  });

  it('goto 는 자릿수 + Enter 로 펼쳐지고 범위를 벗어나면 던진다', () => {
    expect(slideKeyCombos('keynote', 'darwin', 'goto', 12)).toEqual(['1', '2', 'Enter']);
    expect(slideKeyCombos('powerpoint', 'win32', 'goto', 7)).toEqual(['7', 'Enter']);
    expect(() => slideKeyCombos('powerpoint', 'win32', 'goto', GOTO_MIN - 1)).toThrow();
    expect(() => slideKeyCombos('powerpoint', 'win32', 'goto', GOTO_MAX + 1)).toThrow();
    expect(() => slideKeyCombos('powerpoint', 'win32', 'goto', Number.NaN)).toThrow();
  });
});

describe('detectPlatform', () => {
  it('에이전트가 알려준 값을 우선하고 linux 는 win32 표를 쓴다', () => {
    expect(detectPlatform('darwin')).toBe('darwin');
    expect(detectPlatform('win32')).toBe('win32');
    expect(detectPlatform('linux')).toBe('win32');
  });

  it('에이전트 정보가 없으면 브라우저로 추정한다 (node 환경에서는 darwin)', () => {
    expect(['darwin', 'win32']).toContain(detectPlatform(null));
  });
});

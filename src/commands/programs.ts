import type { Program } from '../profile/types';

/**
 * 발표 프로그램별 단축키 표 (기획서 §23: 초기에는 API 대신 키보드 단축키 전송).
 *
 * ⚠ 아래 값은 **실측 전 초기값**이다. 특히 B(화면 검게)와 <n>+Enter 점프는 프로그램 버전·브라우저에 따라
 * 다를 수 있다. 1차 실기 항목 7 "프로그램별 단축키 실측표"로 확인한 뒤 이 주석에 버전과 결과를 적는다.
 *
 * 실측 기록:
 *   - PowerPoint (버전: 미확인) …
 *   - Keynote (버전: 미확인) …
 *   - Google Slides (브라우저: 미확인) …
 */
export type Platform = 'darwin' | 'win32';

export const SLIDE_ACTIONS = ['next', 'prev', 'first', 'goto', 'start', 'blackout', 'return'] as const;
export type SlideAction = (typeof SLIDE_ACTIONS)[number];

export const SLIDE_ACTION_LABEL: Record<SlideAction, string> = {
  next: '다음 슬라이드',
  prev: '이전 슬라이드',
  first: '첫 슬라이드',
  goto: '특정 슬라이드로 이동',
  start: '발표 시작',
  blackout: '화면 가리기',
  return: '발표 화면 복귀',
};

/** '{digits}' 는 goto 번호의 각 자릿수로 펼쳐진다 */
type KeySeq = string[];

const PROGRAM_KEYS: Record<Program, Record<Platform, Record<SlideAction, KeySeq>>> = {
  powerpoint: {
    darwin: {
      next: ['ArrowRight'],
      prev: ['ArrowLeft'],
      first: ['Home'],
      goto: ['{digits}', 'Enter'],
      start: ['Shift+Meta+Enter'],
      blackout: ['B'],
      return: ['Escape'],
    },
    win32: {
      next: ['ArrowRight'],
      prev: ['ArrowLeft'],
      first: ['Home'],
      goto: ['{digits}', 'Enter'],
      start: ['F5'],
      blackout: ['B'],
      return: ['Escape'],
    },
  },
  keynote: {
    darwin: {
      next: ['ArrowRight'],
      prev: ['ArrowLeft'],
      first: ['Home'],
      goto: ['{digits}', 'Enter'],
      start: ['Alt+Meta+P'],
      blackout: ['B'],
      return: ['Escape'],
    },
    // Keynote 는 macOS 전용. Windows 표는 mac 과 같게 두고 실행 시 안내한다
    win32: {
      next: ['ArrowRight'],
      prev: ['ArrowLeft'],
      first: ['Home'],
      goto: ['{digits}', 'Enter'],
      start: ['Alt+Meta+P'],
      blackout: ['B'],
      return: ['Escape'],
    },
  },
  'google-slides': {
    darwin: {
      next: ['ArrowRight'],
      prev: ['ArrowLeft'],
      first: ['Home'],
      goto: ['{digits}', 'Enter'],
      start: ['Meta+Enter'],
      blackout: ['B'],
      return: ['Escape'],
    },
    win32: {
      next: ['ArrowRight'],
      prev: ['ArrowLeft'],
      first: ['Home'],
      goto: ['{digits}', 'Enter'],
      start: ['Ctrl+F5'],
      blackout: ['B'],
      return: ['Escape'],
    },
  },
};

export const GOTO_MIN = 1;
export const GOTO_MAX = 500;

/**
 * 프로그램·플랫폼·동작 → 보낼 키 조합 목록(순서대로). goto 는 자릿수만큼 펼친다.
 * 예: slideKeyCombos('keynote','darwin','goto', 12) → ['1','2','Enter']
 */
export function slideKeyCombos(program: Program, platform: Platform, action: SlideAction, n?: number): string[] {
  const seq = PROGRAM_KEYS[program][platform][action];
  const out: string[] = [];
  for (const k of seq) {
    if (k === '{digits}') {
      const num = Math.round(n ?? GOTO_MIN);
      if (!Number.isFinite(num) || num < GOTO_MIN || num > GOTO_MAX) throw new Error(`슬라이드 번호는 ${GOTO_MIN}~${GOTO_MAX}`);
      for (const d of String(num)) out.push(d);
    } else {
      out.push(k);
    }
  }
  return out;
}

/** 사람이 읽는 표기: ['Shift+Meta+Enter'] → 'Shift+⌘+Enter' 등은 UI 몫. 여기선 '+'/공백 연결만 */
export function describeKeys(combos: string[]): string {
  return combos.join(' ');
}

/** 에이전트가 알려준 플랫폼이 없을 때 브라우저로 추정 (폴백 경로용) */
export function detectPlatform(agentPlatform?: string | null): Platform {
  if (agentPlatform === 'darwin' || agentPlatform === 'win32') return agentPlatform;
  if (agentPlatform === 'linux') return 'win32';
  if (typeof navigator === 'undefined') return 'darwin';
  const ua = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`.toLowerCase();
  return ua.includes('mac') || ua.includes('iphone') || ua.includes('ipad') ? 'darwin' : 'win32';
}

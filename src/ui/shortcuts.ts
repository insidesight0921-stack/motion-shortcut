import { useEffect } from 'react';
import { MODES } from '../modes/catalog';
import type { ModeId } from '../modes/types';
import { useGestureStore } from '../store/gestureStore';
import { useModeStore } from '../store/modeStore';

/**
 * 활성화 토글 단축키: 모든 플랫폼에서 Ctrl+Shift+M (macOS도 Cmd가 아닌 Ctrl). D-007
 * Cmd+Shift+M은 Chrome 프로필 메뉴에 묶여 있어 피했다.
 */
export const ACTIVATION_SHORTCUT = {
  code: 'KeyM',
  ctrlKey: true,
  shiftKey: true,
  label: 'Ctrl+Shift+M',
} as const;

export interface KeyLike {
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat?: boolean;
}

/** 순수 함수: 이 키 입력이 활성화 단축키인가. Alt/Meta가 섞이면 아니다. */
export function matchesActivationShortcut(e: KeyLike): boolean {
  return (
    e.code === ACTIVATION_SHORTCUT.code &&
    e.ctrlKey === ACTIVATION_SHORTCUT.ctrlKey &&
    e.shiftKey === ACTIVATION_SHORTCUT.shiftKey &&
    !e.altKey &&
    !e.metaKey &&
    !e.repeat
  );
}

/**
 * window keydown에서 단축키를 잡아 활성화를 토글한다.
 * 한계: YouTube iframe에 포커스가 있으면 keydown이 부모 문서에 오지 않는다 (README 참고).
 */
export function useActivationShortcut(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!matchesActivationShortcut(e)) return;
      e.preventDefault();
      useGestureStore.getState().toggleEnabled();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

/* ---------- 모드 전환 단축키: Ctrl+Shift+1~4 = 모드, Ctrl+Shift+0 = 대기 토글 ---------- */

export const MODE_SHORTCUT_LABEL = (digit: string) => `Ctrl+Shift+${digit}`;

/** 순수 함수: Ctrl+Shift+Digit0~4 이면 그 모드 id, 아니면 null. Alt/Meta 섞이면 null */
export function matchesModeShortcut(e: KeyLike): ModeId | null {
  if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey || e.repeat) return null;
  const m = /^Digit([0-4])$/.exec(e.code);
  if (!m) return null;
  const digit = m[1];
  for (const id of Object.keys(MODES) as ModeId[]) {
    if (MODES[id].shortcutDigit === digit) return id;
  }
  return null;
}

/**
 * Ctrl+Shift+1~4 → 해당 모드 (대기 중이면 곧바로 그 모드로 깨어남: 'key' 는 해제 허용 경로)
 * Ctrl+Shift+0 → 대기 진입, 이미 대기면 이전 모드로 해제
 */
export function useModeShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const id = matchesModeShortcut(e);
      if (!id) return;
      e.preventDefault();
      const store = useModeStore.getState();
      if (id === 'standby') {
        if (store.current === 'standby') store.wake('key');
        else store.standby('key');
      } else {
        store.setMode(id, 'key');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

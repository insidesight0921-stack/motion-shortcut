import { useEffect } from 'react';
import { useGestureStore } from '../store/gestureStore';

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

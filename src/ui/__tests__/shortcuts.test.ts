import { describe, expect, it } from 'vitest';
import { matchesActivationShortcut, type KeyLike } from '../shortcuts';

const key = (o: Partial<KeyLike>): KeyLike => ({
  code: 'KeyM',
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  ...o,
});

describe('matchesActivationShortcut', () => {
  it('Ctrl+Shift+M 만 일치한다', () => {
    expect(matchesActivationShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(true);
  });

  it('Cmd+Shift+M 은 일치하지 않는다 (macOS Chrome 프로필 메뉴와 충돌 방지)', () => {
    expect(matchesActivationShortcut(key({ metaKey: true, shiftKey: true }))).toBe(false);
  });

  it('Ctrl+M, Shift+M, Ctrl+Shift+Alt+M 은 일치하지 않는다', () => {
    expect(matchesActivationShortcut(key({ ctrlKey: true }))).toBe(false);
    expect(matchesActivationShortcut(key({ shiftKey: true }))).toBe(false);
    expect(matchesActivationShortcut(key({ ctrlKey: true, shiftKey: true, altKey: true }))).toBe(false);
  });

  it('다른 키는 일치하지 않는다', () => {
    expect(matchesActivationShortcut(key({ code: 'KeyN', ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it('키 반복(누르고 있기)은 무시한다', () => {
    expect(matchesActivationShortcut(key({ ctrlKey: true, shiftKey: true, repeat: true }))).toBe(false);
  });
});

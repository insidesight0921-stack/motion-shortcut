import { describe, expect, it } from 'vitest';
import { comboFromKeyboardEvent, comboFromTrustedEvent, formatKeyCombo, parseKeyCombo, resolveKeyTarget, type KeyCombo } from '../keyPress';

const combo = (o: Partial<KeyCombo> & { key: string }): KeyCombo => ({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...o });

describe('parseKeyCombo', () => {
  it('"Shift+ArrowRight" → { key: ArrowRight, shiftKey }', () => {
    expect(parseKeyCombo('Shift+ArrowRight')).toEqual(combo({ key: 'ArrowRight', shiftKey: true }));
  });

  it('단일 키, 공백 키, 한 글자 키(대문자 정규화)', () => {
    expect(parseKeyCombo('ArrowRight')).toEqual(combo({ key: 'ArrowRight' }));
    expect(parseKeyCombo('Space')).toEqual(combo({ key: ' ' }));
    expect(parseKeyCombo('k')).toEqual(combo({ key: 'K' }));
    expect(parseKeyCombo('Shift+K')).toEqual(combo({ key: 'K', shiftKey: true }));
  });

  it('수식키 별칭과 순서 무관 입력을 받는다', () => {
    expect(parseKeyCombo('cmd+shift+p')).toEqual(combo({ key: 'P', shiftKey: true, metaKey: true }));
    expect(parseKeyCombo('Control+Alt+Delete')).toEqual(combo({ key: 'Delete', ctrlKey: true, altKey: true }));
    expect(parseKeyCombo('shift+ctrl+arrowleft')).toEqual(combo({ key: 'ArrowLeft', ctrlKey: true, shiftKey: true }));
  });

  it('잘못된 문자열은 null', () => {
    expect(parseKeyCombo('')).toBeNull();
    expect(parseKeyCombo('   ')).toBeNull();
    expect(parseKeyCombo('Shift')).toBeNull(); // 수식키만
    expect(parseKeyCombo('Ctrl+Shift')).toBeNull();
    expect(parseKeyCombo('ArrowRight+Shift')).toBeNull(); // 키가 중간에 옴
    expect(parseKeyCombo('A+B')).toBeNull();
    expect(parseKeyCombo('+')).toBeNull();
  });
});

describe('formatKeyCombo', () => {
  it('수식키 순서 Ctrl, Alt, Shift, Meta 고정', () => {
    expect(formatKeyCombo(combo({ key: 'ArrowRight', shiftKey: true, ctrlKey: true, metaKey: true, altKey: true }))).toBe('Ctrl+Alt+Shift+Meta+ArrowRight');
    expect(formatKeyCombo(combo({ key: ' ' }))).toBe('Space');
  });

  it('parse ↔ format 왕복', () => {
    for (const text of ['Shift+ArrowRight', 'Ctrl+Shift+K', 'Space', 'Alt+F4', 'Meta+Enter', 'Escape', 'Ctrl+Alt+Shift+Meta+Delete']) {
      const c = parseKeyCombo(text)!;
      expect(c).not.toBeNull();
      expect(formatKeyCombo(c)).toBe(text);
      expect(parseKeyCombo(formatKeyCombo(c))).toEqual(c);
    }
  });

  it('별칭 입력은 정규 형태로 나온다', () => {
    expect(formatKeyCombo(parseKeyCombo('cmd+shift+p')!)).toBe('Shift+Meta+P');
    expect(formatKeyCombo(parseKeyCombo('right')!)).toBe('ArrowRight');
  });
});

describe('comboFromKeyboardEvent / comboFromTrustedEvent', () => {
  const ev = (o: Partial<Parameters<typeof comboFromTrustedEvent>[0]>) => ({ key: 'a', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, isTrusted: true, ...o });

  it('실제 이벤트에서 조합을 만든다 (한 글자 대문자화)', () => {
    expect(comboFromKeyboardEvent(ev({ key: 'a', shiftKey: true }))).toEqual(combo({ key: 'A', shiftKey: true }));
  });

  it('수식키 단독 입력은 null', () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) {
      expect(comboFromKeyboardEvent(ev({ key, shiftKey: key === 'Shift' }))).toBeNull();
    }
  });

  it('캡처 입력은 isTrusted=false 이벤트를 무시한다 (보완 1)', () => {
    expect(comboFromTrustedEvent(ev({ key: 'ArrowRight', isTrusted: false }))).toBeNull();
    expect(comboFromTrustedEvent(ev({ key: 'ArrowRight', isTrusted: undefined }))).toBeNull();
    expect(comboFromTrustedEvent(ev({ key: 'ArrowRight', isTrusted: true }))).toEqual(combo({ key: 'ArrowRight' }));
  });
});

describe('resolveKeyTarget (보완 3)', () => {
  const body = { closest: () => null, name: 'body' };
  const outside = { closest: () => null, name: 'outside' };
  const insideEditor = { closest: (sel: string) => (sel === '[data-mapping-editor]' ? {} : null), name: 'inside' };

  it('activeElement가 없으면 body', () => {
    expect(resolveKeyTarget(null, body)).toBe(body);
    expect(resolveKeyTarget(undefined, body)).toBe(body);
  });

  it('일반 요소는 그대로', () => {
    expect(resolveKeyTarget(outside, body)).toBe(outside);
  });

  it('매핑 편집기 안의 요소면 body로 보낸다', () => {
    expect(resolveKeyTarget(insideEditor, body)).toBe(body);
  });
});

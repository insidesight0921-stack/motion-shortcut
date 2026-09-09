/**
 * 키 조합 파서/포매터 + KeyboardEvent 합성.
 *
 * 한계 (D-015): 스크립트가 만든 KeyboardEvent는 isTrusted=false 다. 브라우저는 이런 이벤트로
 * 기본 동작(스크롤, 폼 제출)을 하지 않고, YouTube iframe 같은 다른 문서에는 전달되지도 않는다.
 * 따라서 key.press는 "우리 페이지 안에서 keydown을 듣는 코드"에만 동작한다.
 */
export interface KeyCombo {
  /** KeyboardEvent.key 값. 한 글자 키는 대문자로 정규화 (예: 'K') */
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/** 포맷 순서 고정: Ctrl, Alt, Shift, Meta. 순서가 고정돼야 parse ↔ format 왕복이 성립한다 */
const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;

const MODIFIER_ALIASES: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  win: 'Meta',
};

/** 수식키 이름 (KeyboardEvent.key 기준). 이것만 눌린 상태는 조합으로 인정하지 않는다 */
const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn']);

/** 자주 쓰는 키의 별칭 → KeyboardEvent.key */
const KEY_ALIASES: Record<string, string> = {
  space: ' ',
  spacebar: ' ',
  esc: 'Escape',
  return: 'Enter',
  del: 'Delete',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

/** 표시용 이름 (key → 사람이 읽는 이름) */
const KEY_DISPLAY: Record<string, string> = { ' ': 'Space' };

function normalizeKeyName(raw: string): string | null {
  if (raw.length === 0) return null;
  const alias = KEY_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  if (raw.length === 1) return raw.toUpperCase();
  // 'arrowright' 처럼 소문자로 들어온 이름도 받아 준다
  const canonical = CANONICAL_KEYS.get(raw.toLowerCase());
  return canonical ?? raw;
}

const CANONICAL_KEY_LIST = [
  'Enter',
  'Escape',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
];
const CANONICAL_KEYS = new Map(CANONICAL_KEY_LIST.map((k) => [k.toLowerCase(), k]));

/**
 * "Shift+ArrowRight" → { key: 'ArrowRight', shiftKey: true, ... }
 * 실패(빈 문자열, 수식키만, 알 수 없는 토큰 순서) → null
 */
export function parseKeyCombo(text: string): KeyCombo | null {
  const parts = text
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  // "Shift++" 처럼 '+' 자체를 키로 쓰는 경우는 지원하지 않는다
  if (parts.length === 0) return null;

  const combo: KeyCombo = { key: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const mod = MODIFIER_ALIASES[part.toLowerCase()];
    const isLast = i === parts.length - 1;
    if (mod && !isLast) {
      if (mod === 'Ctrl') combo.ctrlKey = true;
      else if (mod === 'Alt') combo.altKey = true;
      else if (mod === 'Shift') combo.shiftKey = true;
      else combo.metaKey = true;
      continue;
    }
    if (mod && isLast) return null; // 수식키만 있는 조합
    if (!isLast) return null; // 수식키가 아닌 것이 중간에 있음
    const key = normalizeKeyName(part);
    if (!key || MODIFIER_KEYS.has(key)) return null;
    combo.key = key;
  }
  return combo.key ? combo : null;
}

/** { key:'ArrowRight', shiftKey:true } → "Shift+ArrowRight" */
export function formatKeyCombo(c: KeyCombo): string {
  const mods: string[] = [];
  if (c.ctrlKey) mods.push('Ctrl');
  if (c.altKey) mods.push('Alt');
  if (c.shiftKey) mods.push('Shift');
  if (c.metaKey) mods.push('Meta');
  const keyName = KEY_DISPLAY[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key);
  return [...mods, keyName].join('+');
}

export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  isTrusted?: boolean;
}

/** 실제 KeyboardEvent → 조합. 수식키 단독 입력은 null */
export function comboFromKeyboardEvent(e: KeyEventLike): KeyCombo | null {
  if (!e.key || MODIFIER_KEYS.has(e.key)) return null;
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return { key, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey };
}

/**
 * 키 캡처 입력이 받아들일 이벤트인가. 합성 이벤트(isTrusted=false)는 무시한다 —
 * 우리 자신이 dispatch한 key.press가 캡처 입력에 되먹임되는 것을 막는다.
 */
export function comboFromTrustedEvent(e: KeyEventLike): KeyCombo | null {
  if (e.isTrusted !== true) return null;
  return comboFromKeyboardEvent(e);
}

/** DOM 없이 테스트할 수 있도록 최소 인터페이스만 요구한다 */
export interface ElementLike {
  closest?(selector: string): unknown;
}

export const MAPPING_EDITOR_SELECTOR = '[data-mapping-editor]';

/**
 * 합성 키 이벤트를 보낼 대상. 기본은 activeElement, 없으면 body.
 * activeElement가 매핑 편집기 안의 폼 요소면 body로 보낸다 — 방금 편집한 드롭다운이나
 * 키 캡처 입력이 자기 자신에게 키를 받아 값을 바꾸는 사고를 막는다 (보완 3).
 */
export function resolveKeyTarget<T extends ElementLike>(activeElement: T | null | undefined, body: T): T {
  if (!activeElement) return body;
  if (typeof activeElement.closest === 'function' && activeElement.closest(MAPPING_EDITOR_SELECTOR)) return body;
  return activeElement;
}

/** key 값에서 code를 추정한다. 정확하지 않아도 되며 리스너 대부분은 key를 본다 */
function guessCode(key: string): string {
  if (key === ' ') return 'Space';
  if (/^[A-Z]$/.test(key)) return `Key${key}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return key;
}

/**
 * keydown + keyup 을 순서대로 dispatch 한다. bubbles=true 라 window 리스너까지 올라간다.
 * 반환값: keydown의 preventDefault 여부 (리스너가 처리했는지 대략 알 수 있다).
 */
export function dispatchKeyCombo(combo: KeyCombo, target?: EventTarget): boolean {
  const t =
    target ??
    resolveKeyTarget(document.activeElement as (Element & ElementLike) | null, document.body as Element & ElementLike);
  const init: KeyboardEventInit = {
    key: combo.key,
    code: guessCode(combo.key),
    ctrlKey: combo.ctrlKey,
    altKey: combo.altKey,
    shiftKey: combo.shiftKey,
    metaKey: combo.metaKey,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  const downHandled = !t.dispatchEvent(new KeyboardEvent('keydown', init));
  t.dispatchEvent(new KeyboardEvent('keyup', init));
  return downHandled;
}

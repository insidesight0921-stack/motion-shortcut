import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPPING } from '../defaults';
import { loadMapping, normalizeMapping, saveMapping } from '../storage';
import { LOCKED_ENTRY, MAPPING_STORAGE_KEY, MAPPING_VERSION, type Mapping } from '../types';

/** 메모리 Storage */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('mapping/storage', () => {
  it('저장 → 복원 왕복', () => {
    const s = memoryStorage();
    const m: Mapping = {
      ...DEFAULT_MAPPING,
      open_palm: { commandId: 'key.press', params: { combo: 'Space' } },
      swipe_right: { commandId: 'media.seekForward', params: { seconds: 30 } },
    };
    saveMapping(m, s);
    const stored = JSON.parse(s.getItem(MAPPING_STORAGE_KEY)!);
    expect(stored.version).toBe(MAPPING_VERSION);
    expect(loadMapping(s)).toEqual(m);
  });

  it('저장된 것이 없으면 기본값', () => {
    expect(loadMapping(memoryStorage())).toEqual(DEFAULT_MAPPING);
  });

  it('JSON 파싱 실패 → 기본값', () => {
    expect(loadMapping(memoryStorage({ [MAPPING_STORAGE_KEY]: '{not json' }))).toEqual(DEFAULT_MAPPING);
  });

  it('버전 불일치 → 기본값', () => {
    const s = memoryStorage({ [MAPPING_STORAGE_KEY]: JSON.stringify({ version: 99, mapping: { open_palm: { commandId: 'none', params: {} } } }) });
    expect(loadMapping(s)).toEqual(DEFAULT_MAPPING);
  });

  it('항목 단위 폴백: 깨진 항목만 기본값으로, 나머지는 유지', () => {
    const s = memoryStorage({
      [MAPPING_STORAGE_KEY]: JSON.stringify({
        version: 1,
        mapping: {
          open_palm: { commandId: 'bogus.command', params: {} },
          swipe_right: { commandId: 'media.seekForward', params: { seconds: 9999 } }, // 범위 밖
          swipe_left: { commandId: 'key.press', params: { combo: 'Shift+K' } }, // 정상
          circle: 'garbage',
        },
      }),
    });
    const m = loadMapping(s);
    expect(m.open_palm).toEqual(DEFAULT_MAPPING.open_palm);
    expect(m.swipe_right).toEqual(DEFAULT_MAPPING.swipe_right);
    expect(m.swipe_left).toEqual({ commandId: 'key.press', params: { combo: 'Shift+K' } });
    expect(m.circle).toEqual(DEFAULT_MAPPING.circle);
  });

  it('주먹 매핑을 덮어쓰려는 입력은 무시된다', () => {
    const m = normalizeMapping({ fist: { commandId: 'media.playPause', params: {} } });
    expect(m.fist).toEqual(LOCKED_ENTRY);
    const s = memoryStorage();
    saveMapping({ ...DEFAULT_MAPPING, fist: { commandId: 'key.press', params: { combo: 'Space' } } }, s);
    expect(loadMapping(s).fist).toEqual(LOCKED_ENTRY);
  });

  it('system.toggleEnabled 를 다른 제스처에 붙이면 기본값으로 대체', () => {
    const m = normalizeMapping({ open_palm: { commandId: 'system.toggleEnabled', params: {} } });
    expect(m.open_palm).toEqual(DEFAULT_MAPPING.open_palm);
  });

  it('파라미터가 없으면 그 명령의 기본값을 채운다', () => {
    const m = normalizeMapping({ circle: { commandId: 'timer.toggle' } });
    expect(m.circle).toEqual({ commandId: 'timer.toggle', params: { minutes: 3 } });
  });
});

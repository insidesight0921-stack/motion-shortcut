import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPPING, emptyMapping } from '../defaults';
import { defaultByMode, loadAll, loadMapping, MAPPING_STORAGE_KEY_V2, normalizeMapping, saveAll, saveMapping } from '../storage';
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

describe('v2 모드별 매핑과 v1 → v2 마이그레이션', () => {
  it('기본값: media 는 기본 매핑, 나머지 모드는 빈 프리셋(none + 주먹 고정)', () => {
    const d = defaultByMode();
    expect(d.media).toEqual(DEFAULT_MAPPING);
    expect(d.reading).toEqual(emptyMapping());
    expect(d.presentation.fist).toEqual(LOCKED_ENTRY);
    expect(d.meeting.open_palm.commandId).toBe('none');
  });

  it('v2 저장 → 복원 왕복', () => {
    const s = memoryStorage();
    const byMode = defaultByMode();
    byMode.presentation = { ...byMode.presentation, swipe_right: { commandId: 'key.press', params: { combo: 'ArrowRight' } } };
    saveAll(byMode, s);
    expect(JSON.parse(s.getItem(MAPPING_STORAGE_KEY_V2)!).version).toBe(2);
    expect(loadAll(s)).toEqual(byMode);
  });

  it('v1 만 있으면 media 로 승격되고 나머지는 기본값, 결과가 v2 로 저장된다 (v1 은 남김)', () => {
    const s = memoryStorage({
      [MAPPING_STORAGE_KEY]: JSON.stringify({
        version: MAPPING_VERSION,
        mapping: { ...DEFAULT_MAPPING, open_palm: { commandId: 'key.press', params: { combo: 'Space' } } },
      }),
    });
    const all = loadAll(s);
    expect(all.media.open_palm).toEqual({ commandId: 'key.press', params: { combo: 'Space' } });
    expect(all.media.swipe_right).toEqual(DEFAULT_MAPPING.swipe_right);
    expect(all.reading).toEqual(emptyMapping());
    expect(s.getItem(MAPPING_STORAGE_KEY_V2)).not.toBeNull();
    expect(s.getItem(MAPPING_STORAGE_KEY)).not.toBeNull();
    // 두 번째 읽기는 v2 를 쓴다
    expect(loadAll(s)).toEqual(all);
  });

  it('v2 가 있으면 v1 은 무시한다', () => {
    const s = memoryStorage({
      [MAPPING_STORAGE_KEY]: JSON.stringify({ version: 1, mapping: { ...DEFAULT_MAPPING, open_palm: { commandId: 'none', params: {} } } }),
    });
    const byMode = defaultByMode();
    saveAll(byMode, s);
    expect(loadAll(s).media.open_palm).toEqual(DEFAULT_MAPPING.open_palm);
  });

  it('손상된 v1 과 v2 → 전부 기본값', () => {
    expect(loadAll(memoryStorage({ [MAPPING_STORAGE_KEY]: '{oops', [MAPPING_STORAGE_KEY_V2]: '[' }))).toEqual(defaultByMode());
    expect(loadAll(memoryStorage({ [MAPPING_STORAGE_KEY_V2]: JSON.stringify({ version: 3, byMode: {} }) }))).toEqual(defaultByMode());
  });

  it('v2 에 일부 모드만 있으면 빠진 모드는 기본값으로 채운다', () => {
    const s = memoryStorage({
      [MAPPING_STORAGE_KEY_V2]: JSON.stringify({ version: 2, byMode: { meeting: { circle: { commandId: 'timer.toggle', params: { minutes: 10 } } } } }),
    });
    const all = loadAll(s);
    expect(all.meeting.circle).toEqual({ commandId: 'timer.toggle', params: { minutes: 10 } });
    expect(all.meeting.open_palm.commandId).toBe('none');
    expect(all.media).toEqual(DEFAULT_MAPPING);
    expect(all.reading).toEqual(emptyMapping());
  });

  it('v2 에서도 주먹은 모든 모드에서 고정된다', () => {
    const s = memoryStorage({
      [MAPPING_STORAGE_KEY_V2]: JSON.stringify({ version: 2, byMode: { media: { fist: { commandId: 'none', params: {} } }, reading: { fist: { commandId: 'key.press', params: { combo: 'Space' } } } } }),
    });
    const all = loadAll(s);
    expect(all.media.fist).toEqual(LOCKED_ENTRY);
    expect(all.reading.fist).toEqual(LOCKED_ENTRY);
  });
});

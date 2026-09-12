import { describe, expect, it } from 'vitest';
import { emptyMapping } from '../../mapping/defaults';
import { LOCKED_ENTRY, MAPPING_STORAGE_KEY } from '../../mapping/types';
import { createProfile, defaultSettings, defaultSlideMapping } from '../defaults';
import { LEGACY_V2_KEY, migrateLegacyToProfileMapping } from '../migrate';
import { loadProfiles, normalizeProfile, normalizeSettings, saveProfiles } from '../storage';
import { PRESENTATION_MODES, PROFILES_STORAGE_KEY } from '../types';

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

const NOW = 1_700_000_000_000;

describe('기본값', () => {
  it('새 프로필: 슬라이드 모드는 기본 매핑, 나머지 모드는 빈 프리셋, 주먹은 모든 모드에서 고정', () => {
    const p = createProfile('테스트', 'keynote', NOW);
    expect(p.program).toBe('keynote');
    expect(p.mappingByMode.slide).toEqual(defaultSlideMapping('keynote'));
    expect(p.mappingByMode.slide.swipe_right).toEqual({ commandId: 'key.press', params: { combo: 'ArrowRight' } });
    expect(p.mappingByMode.cursor).toEqual(emptyMapping());
    for (const m of PRESENTATION_MODES) expect(p.mappingByMode[m].fist).toEqual(LOCKED_ENTRY);
    expect(p.settings).toEqual(defaultSettings());
    expect(p.settings.motionToggle).toBe('x_cross');
    expect(p.settings.voiceEnabled).toBe(false);
    expect(p.assets).toEqual([]);
  });

  it('빈 이름은 기본 이름으로', () => {
    expect(createProfile('   ', 'powerpoint', NOW).name).toBe('기본 프로필');
  });
});

describe('v3 저장 → 복원', () => {
  it('왕복', () => {
    const s = memoryStorage();
    const p = createProfile('발표 A', 'google-slides', NOW);
    p.mappingByMode.slide.open_palm = { commandId: 'key.press', params: { combo: 'Space' } };
    p.settings.cursorSensitivity = 2;
    saveProfiles({ version: 3, activeProfileId: p.id, profiles: [p] }, s);
    const { stored, migratedFromLegacy } = loadProfiles(s, NOW);
    expect(migratedFromLegacy).toBe(false);
    expect(stored.activeProfileId).toBe(p.id);
    expect(stored.profiles[0]).toEqual(p);
  });

  it('손상된 v3 → 기본 프로필 하나', () => {
    const { stored } = loadProfiles(memoryStorage({ [PROFILES_STORAGE_KEY]: '{bad' }), NOW);
    expect(stored.profiles).toHaveLength(1);
    expect(stored.profiles[0].name).toBe('기본 프로필');
    expect(stored.activeProfileId).toBe(stored.profiles[0].id);
  });

  it('activeProfileId 가 없는 프로필을 가리키면 첫 프로필로', () => {
    const s = memoryStorage();
    const a = createProfile('A', 'powerpoint', NOW);
    saveProfiles({ version: 3, activeProfileId: 'ghost', profiles: [a] }, s);
    expect(loadProfiles(s, NOW).stored.activeProfileId).toBe(a.id);
  });

  it('프로필 항목 단위 폴백: 깨진 필드만 기본값, 중복 id 는 첫 것만', () => {
    const s = memoryStorage({
      [PROFILES_STORAGE_KEY]: JSON.stringify({
        version: 3,
        activeProfileId: 'p1',
        profiles: [
          { id: 'p1', name: '', program: 'prezi', mappingByMode: { slide: { circle: { commandId: 'bogus' } } }, settings: { cursorSensitivity: 99, laser: { color: 'green' }, motionToggle: 'fist' } },
          { id: 'p1', name: '중복' },
          'garbage',
          { name: 'id 없음' },
        ],
      }),
    });
    const { stored } = loadProfiles(s, NOW);
    expect(stored.profiles).toHaveLength(1);
    const p = stored.profiles[0];
    expect(p.name).toBe('기본 프로필');
    expect(p.program).toBe('powerpoint');
    expect(p.mappingByMode.slide.circle).toEqual(defaultSlideMapping('powerpoint').circle);
    expect(p.settings.cursorSensitivity).toBe(3); // 상한으로 잘림
    expect(p.settings.laser.color).toBe('blue');
    expect(p.settings.motionToggle).toBe('fist');
  });

  it('주먹을 덮어쓰려는 입력은 무시된다', () => {
    const p = normalizeProfile({ id: 'x', mappingByMode: { slide: { fist: { commandId: 'key.press', params: { combo: 'Space' } } } } }, NOW)!;
    expect(p.mappingByMode.slide.fist).toEqual(LOCKED_ENTRY);
  });
});

describe('설정 정규화', () => {
  it('범위와 열거값', () => {
    const s = normalizeSettings({ cursorSensitivity: 0.1, cursorDeadzone: 9, activeHand: 'left', agentPort: 80, voiceEnabled: 'yes', laser: { size: 'lg' } });
    expect(s.cursorSensitivity).toBe(0.5);
    expect(s.cursorDeadzone).toBe(0.5);
    expect(s.activeHand).toBe('left');
    expect(s.agentPort).toBe(1024);
    expect(s.voiceEnabled).toBe(false);
    expect(s.laser).toEqual({ size: 'lg', color: 'blue' });
  });
});

describe('v2 → v3 승격 (D-017)', () => {
  const v2 = (byMode: Record<string, unknown>) => JSON.stringify({ version: 2, byMode });

  it('presentation → slide, media 의 key.press 만 병합, 겹치면 presentation 우선', () => {
    const s = memoryStorage({
      [LEGACY_V2_KEY]: v2({
        presentation: { open_palm: { commandId: 'key.press', params: { combo: 'B' } }, swipe_right: { commandId: 'key.press', params: { combo: 'PageDown' } } },
        media: {
          swipe_right: { commandId: 'key.press', params: { combo: 'ArrowRight' } }, // 겹침 → presentation 이 이김
          swipe_left: { commandId: 'key.press', params: { combo: 'ArrowLeft' } }, // 병합
          circle: { commandId: 'timer.toggle', params: { minutes: 3 } }, // 사라진 명령 → 병합 안 됨
          open_palm: { commandId: 'media.playPause', params: {} },
        },
        reading: { circle: { commandId: 'key.press', params: { combo: 'Space' } } }, // reading 은 무시
      }),
    });
    const { stored, migratedFromLegacy } = loadProfiles(s, NOW);
    expect(migratedFromLegacy).toBe(true);
    expect(stored.profiles).toHaveLength(1);
    const slide = stored.profiles[0].mappingByMode.slide;
    expect(slide.open_palm).toEqual({ commandId: 'key.press', params: { combo: 'B' } });
    expect(slide.swipe_right).toEqual({ commandId: 'key.press', params: { combo: 'PageDown' } });
    expect(slide.swipe_left).toEqual({ commandId: 'key.press', params: { combo: 'ArrowLeft' } });
    expect(slide.circle.commandId).toBe('none');
    expect(slide.fist).toEqual(LOCKED_ENTRY);
    expect(stored.profiles[0].mappingByMode.cursor).toEqual(emptyMapping());
    // v3 로 저장되고 v2 는 남아 있다
    expect(s.getItem(PROFILES_STORAGE_KEY)).not.toBeNull();
    expect(s.getItem(LEGACY_V2_KEY)).not.toBeNull();
    // 두 번째 읽기는 v3 를 쓴다
    expect(loadProfiles(s, NOW).migratedFromLegacy).toBe(false);
  });

  it('presentation 에 media.* 가 매핑돼 있었으면 none', () => {
    const m = migrateLegacyToProfileMapping({ presentation: { ...emptyMapping(), open_palm: { commandId: 'media.playPause', params: {} }, swipe_right: { commandId: 'key.press', params: { combo: 'ArrowRight' } } } }, 'powerpoint');
    expect(m.slide.open_palm.commandId).toBe('none');
    expect(m.slide.swipe_right.params).toEqual({ combo: 'ArrowRight' });
  });

  it('옛 데이터가 전부 비어 있으면(손대지 않은 프리셋) 새 기본 슬라이드 매핑', () => {
    const m = migrateLegacyToProfileMapping({ presentation: emptyMapping(), media: { ...emptyMapping(), open_palm: { commandId: 'media.playPause', params: {} } } }, 'keynote');
    expect(m.slide).toEqual(defaultSlideMapping('keynote'));
  });

  it('v1 만 있으면 media 로 보고 key.press 만 승격', () => {
    const s = memoryStorage({
      [MAPPING_STORAGE_KEY]: JSON.stringify({ version: 1, mapping: { ...emptyMapping(), open_palm: { commandId: 'key.press', params: { combo: 'Space' } }, circle: { commandId: 'timer.toggle', params: { minutes: 3 } } } }),
    });
    const { stored, migratedFromLegacy } = loadProfiles(s, NOW);
    expect(migratedFromLegacy).toBe(true);
    expect(stored.profiles[0].mappingByMode.slide.open_palm).toEqual({ commandId: 'key.press', params: { combo: 'Space' } });
    expect(stored.profiles[0].mappingByMode.slide.circle.commandId).toBe('none');
  });

  it('v3 가 있으면 v2 는 무시한다', () => {
    const s = memoryStorage({ [LEGACY_V2_KEY]: v2({ presentation: { ...emptyMapping(), open_palm: { commandId: 'key.press', params: { combo: 'B' } } } }) });
    const p = createProfile('있음', 'keynote', NOW);
    saveProfiles({ version: 3, activeProfileId: p.id, profiles: [p] }, s);
    const { stored, migratedFromLegacy } = loadProfiles(s, NOW);
    expect(migratedFromLegacy).toBe(false);
    expect(stored.profiles[0].name).toBe('있음');
  });
});

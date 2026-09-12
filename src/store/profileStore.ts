import { create } from 'zustand';
import { COMMANDS, defaultParams } from '../commands/catalog';
import type { CommandId, CommandParams } from '../commands/types';
import type { GestureId } from '../gesture/types';
import { LOCKED_GESTURE, type Mapping, type MappingEntry } from '../mapping/types';
import { createProfile, modeDefaultMapping } from '../profile/defaults';
import { loadProfiles, saveProfiles } from '../profile/storage';
import type { PresentationModeId, Profile, ProfileSettings, Program, StoredProfiles } from '../profile/types';

interface ProfileState {
  profiles: Profile[];
  activeProfileId: string;
  /** 옛 매핑에서 승격됐음을 1회 안내하기 위한 플래그. UI 가 확인하면 끈다 */
  migratedFromLegacy: boolean;

  active: () => Profile;
  mapping: (mode: PresentationModeId) => Mapping;

  create: (name: string, program: Program) => Profile;
  remove: (id: string) => void;
  setActive: (id: string) => void;
  rename: (id: string, name: string) => void;
  setProgram: (id: string, program: Program) => void;
  updateSettings: (patch: Partial<ProfileSettings>) => void;

  setEntry: (mode: PresentationModeId, gesture: GestureId, entry: MappingEntry) => void;
  setCommand: (mode: PresentationModeId, gesture: GestureId, commandId: CommandId) => void;
  setParams: (mode: PresentationModeId, gesture: GestureId, params: CommandParams) => void;
  resetMapping: (mode: PresentationModeId) => void;

  dismissMigrationNotice: () => void;
}

function toStored(s: Pick<ProfileState, 'profiles' | 'activeProfileId'>): StoredProfiles {
  return { version: 3, activeProfileId: s.activeProfileId, profiles: s.profiles };
}

const initial = loadProfiles();

/**
 * 발표 프로필 스토어. 매핑은 프로필 안에 모드별로 산다. 변경은 즉시 v3 로 저장된다.
 * 프로필을 지우면 그 안의 리허설 통계·자료 슬롯도 함께 사라진다 (§18).
 */
export const useProfileStore = create<ProfileState>((set, get) => {
  const persist = (patch: Partial<Pick<ProfileState, 'profiles' | 'activeProfileId'>>) => {
    const next = { profiles: patch.profiles ?? get().profiles, activeProfileId: patch.activeProfileId ?? get().activeProfileId };
    saveProfiles(toStored(next));
    set(next);
  };
  const updateProfile = (id: string, fn: (p: Profile) => Profile) => {
    persist({ profiles: get().profiles.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p)) });
  };
  const updateActiveMapping = (mode: PresentationModeId, fn: (m: Mapping) => Mapping) => {
    const id = get().activeProfileId;
    updateProfile(id, (p) => ({ ...p, mappingByMode: { ...p.mappingByMode, [mode]: fn(p.mappingByMode[mode]) } }));
  };

  return {
    profiles: initial.stored.profiles,
    activeProfileId: initial.stored.activeProfileId ?? initial.stored.profiles[0].id,
    migratedFromLegacy: initial.migratedFromLegacy,

    active: () => {
      const { profiles, activeProfileId } = get();
      return profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
    },
    mapping: (mode) => get().active().mappingByMode[mode],

    create: (name, program) => {
      const p = createProfile(name, program);
      persist({ profiles: [...get().profiles, p], activeProfileId: p.id });
      return p;
    },
    remove: (id) => {
      const remaining = get().profiles.filter((p) => p.id !== id);
      const profiles = remaining.length ? remaining : [createProfile('기본 프로필', 'powerpoint')];
      const activeProfileId = get().activeProfileId === id ? profiles[0].id : get().activeProfileId;
      persist({ profiles, activeProfileId });
    },
    setActive: (id) => {
      if (get().profiles.some((p) => p.id === id)) persist({ activeProfileId: id });
    },
    rename: (id, name) => updateProfile(id, (p) => ({ ...p, name: name.trim() || p.name })),
    setProgram: (id, program) => updateProfile(id, (p) => ({ ...p, program })),
    updateSettings: (patch) => updateProfile(get().activeProfileId, (p) => ({ ...p, settings: { ...p.settings, ...patch } })),

    setEntry: (mode, gesture, entry) => {
      if (gesture === LOCKED_GESTURE) return; // 주먹은 편집 불가
      updateActiveMapping(mode, (m) => ({ ...m, [gesture]: { commandId: entry.commandId, params: { ...entry.params } } }));
    },
    setCommand: (mode, gesture, commandId) => {
      const def = COMMANDS[commandId];
      if (!def || !def.assignable) return;
      get().setEntry(mode, gesture, { commandId, params: defaultParams(def) });
    },
    setParams: (mode, gesture, params) => {
      const cur = get().mapping(mode)[gesture];
      if (!cur) return;
      get().setEntry(mode, gesture, { commandId: cur.commandId, params });
    },
    resetMapping: (mode) => {
      const program = get().active().program;
      updateActiveMapping(mode, () => modeDefaultMapping(mode, program));
    },

    dismissMigrationNotice: () => set({ migratedFromLegacy: false }),
  };
});

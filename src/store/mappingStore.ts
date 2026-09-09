import { create } from 'zustand';
import { COMMANDS, defaultParams } from '../commands/catalog';
import type { CommandId, CommandParams } from '../commands/types';
import type { GestureId } from '../gesture/types';
import { cloneMapping } from '../mapping/defaults';
import { defaultByMode, loadAll, saveAll, type MappingByMode } from '../mapping/storage';
import { LOCKED_GESTURE, type Mapping, type MappingEntry } from '../mapping/types';
import { MODES } from '../modes/catalog';
import type { UserModeId } from '../modes/types';

interface MappingState {
  /** 모드별 매핑 (standby 는 매핑이 없다) */
  byMode: MappingByMode;
  /** 키 캡처 입력이 열려 있는 동안 true. 이때 매핑 실행은 일시 중지된다 (보완 1, D-015) */
  capturing: boolean;

  getMapping: (mode: UserModeId) => Mapping;
  setEntry: (mode: UserModeId, gesture: GestureId, entry: MappingEntry) => void;
  /** 명령을 바꾸면 파라미터는 그 명령의 기본값으로 초기화 */
  setCommand: (mode: UserModeId, gesture: GestureId, commandId: CommandId) => void;
  setParams: (mode: UserModeId, gesture: GestureId, params: CommandParams) => void;
  /** 한 모드만 그 모드의 기본값으로 */
  reset: (mode: UserModeId) => void;
  resetAll: () => void;
  setCapturing: (capturing: boolean) => void;
}

export const useMappingStore = create<MappingState>((set, get) => ({
  byMode: loadAll(),
  capturing: false,

  getMapping: (mode) => get().byMode[mode],

  setEntry: (mode, gesture, entry) => {
    if (gesture === LOCKED_GESTURE) return; // 주먹은 편집 불가
    const current = get().byMode[mode];
    const mapping: Mapping = { ...current, [gesture]: { commandId: entry.commandId, params: { ...entry.params } } };
    const byMode = { ...get().byMode, [mode]: mapping };
    saveAll(byMode);
    set({ byMode });
  },
  setCommand: (mode, gesture, commandId) => {
    const def = COMMANDS[commandId];
    if (!def || !def.assignable) return;
    get().setEntry(mode, gesture, { commandId, params: defaultParams(def) });
  },
  setParams: (mode, gesture, params) => {
    const cur = get().byMode[mode][gesture];
    if (!cur) return;
    get().setEntry(mode, gesture, { commandId: cur.commandId, params });
  },
  reset: (mode) => {
    const base = MODES[mode].defaultMapping;
    if (!base) return;
    const byMode = { ...get().byMode, [mode]: cloneMapping(base) };
    saveAll(byMode);
    set({ byMode });
  },
  resetAll: () => {
    const byMode = defaultByMode();
    saveAll(byMode);
    set({ byMode });
  },
  setCapturing: (capturing) => set({ capturing }),
}));

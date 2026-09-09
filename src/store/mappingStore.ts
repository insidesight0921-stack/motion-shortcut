import { create } from 'zustand';
import { COMMANDS, defaultParams } from '../commands/catalog';
import type { CommandId, CommandParams } from '../commands/types';
import type { GestureId } from '../gesture/types';
import { cloneMapping, DEFAULT_MAPPING } from '../mapping/defaults';
import { clearMapping, loadMapping, saveMapping } from '../mapping/storage';
import { LOCKED_GESTURE, type Mapping, type MappingEntry } from '../mapping/types';

interface MappingState {
  mapping: Mapping;
  /** 키 캡처 입력이 열려 있는 동안 true. 이때 매핑 실행은 일시 중지된다 (보완 1) */
  capturing: boolean;

  setEntry: (gesture: GestureId, entry: MappingEntry) => void;
  /** 명령을 바꾸면 파라미터는 그 명령의 기본값으로 초기화 */
  setCommand: (gesture: GestureId, commandId: CommandId) => void;
  setParams: (gesture: GestureId, params: CommandParams) => void;
  reset: () => void;
  setCapturing: (capturing: boolean) => void;
}

export const useMappingStore = create<MappingState>((set, get) => ({
  mapping: loadMapping(),
  capturing: false,

  setEntry: (gesture, entry) => {
    if (gesture === LOCKED_GESTURE) return; // 주먹은 편집 불가
    const mapping = { ...get().mapping, [gesture]: { commandId: entry.commandId, params: { ...entry.params } } };
    saveMapping(mapping);
    set({ mapping });
  },
  setCommand: (gesture, commandId) => {
    const def = COMMANDS[commandId];
    if (!def || !def.assignable) return;
    get().setEntry(gesture, { commandId, params: defaultParams(def) });
  },
  setParams: (gesture, params) => {
    const cur = get().mapping[gesture];
    if (!cur) return;
    get().setEntry(gesture, { commandId: cur.commandId, params });
  },
  reset: () => {
    clearMapping();
    set({ mapping: cloneMapping(DEFAULT_MAPPING) });
  },
  setCapturing: (capturing) => set({ capturing }),
}));

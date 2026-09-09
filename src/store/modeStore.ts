import { create } from 'zustand';
import { MODES } from '../modes/catalog';
import { type ModeId, type SwitchSource, STANDBY } from '../modes/types';

/** 모드 전환 직후 제스처를 무시하는 시간. gesture/ 를 건드리지 않고 UI 층에서 검사한다 (D-016) */
export const MODE_SWITCH_COOLDOWN_MS = 1500;
export const VOICE_SETTINGS_KEY = 'motion-shortcut.voice.v1';

export type VoiceStatus = 'unsupported' | 'off' | 'requesting' | 'listening' | 'denied' | 'error';

export interface VoiceState {
  status: VoiceStatus;
  /** error 상태의 사유 (사람이 읽는 문장) */
  error?: string;
  lastUtterance?: string;
  /** 마지막 발화의 해석 결과 (예: "switch:presentation", "의도 없음") */
  lastIntent?: string;
  /** ko-KR 음성이 있어 TTS 를 낼 수 있는가 (보완 2) */
  ttsAvailable: boolean;
}

export interface ModeSwitch {
  from: ModeId;
  to: ModeId;
  source: SwitchSource;
  utterance?: string;
  at: number;
}

export type GestureGate = { blocked: false } | { blocked: true; reason: '대기 모드' | '모드 전환 직후' };

/** 순수 함수: 이 시점에 제스처 실행(주먹 포함)을 막아야 하는가 */
export function gestureGate(current: ModeId, cooldownUntil: number, now: number): GestureGate {
  if (current === STANDBY) return { blocked: true, reason: '대기 모드' };
  if (now < cooldownUntil) return { blocked: true, reason: '모드 전환 직후' };
  return { blocked: false };
}

/** 대기 해제를 허용하는 경로. 제스처로는 풀리지 않는다 */
export const WAKE_SOURCES: SwitchSource[] = ['voice', 'ui', 'key'];

interface ModeState {
  current: ModeId;
  previous: ModeId | null;
  switchedAt: number;
  cooldownUntil: number;
  lastSwitch: ModeSwitch | null;
  voice: VoiceState;
  ttsEnabled: boolean;

  /** 모드를 바꾼다. 같은 모드면 false. 대기에서 나올 때(= wake)는 WAKE_SOURCES 만 허용 */
  setMode: (id: ModeId, source: SwitchSource, opts?: { utterance?: string; now?: number }) => boolean;
  standby: (source: SwitchSource, opts?: { utterance?: string; now?: number }) => boolean;
  /** previous(사용자 모드) 로 복귀. previous 가 없으면 media */
  wake: (source: SwitchSource, opts?: { utterance?: string; now?: number }) => boolean;
  gate: (now?: number) => GestureGate;

  setVoice: (patch: Partial<VoiceState>) => void;
  setTtsEnabled: (enabled: boolean) => void;
}

function loadTtsEnabled(): boolean {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(VOICE_SETTINGS_KEY) : null;
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { ttsEnabled?: unknown };
    return parsed.ttsEnabled !== false;
  } catch {
    return true;
  }
}

function saveTtsEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify({ ttsEnabled: enabled }));
  } catch {
    // 무시
  }
}

export const useModeStore = create<ModeState>((set, get) => ({
  current: 'media',
  previous: null,
  switchedAt: 0,
  cooldownUntil: 0,
  lastSwitch: null,
  voice: { status: 'off', ttsAvailable: false },
  ttsEnabled: loadTtsEnabled(),

  setMode: (id, source, opts = {}) => {
    const { current } = get();
    if (!MODES[id] || id === current) return false;
    if (current === STANDBY && !WAKE_SOURCES.includes(source)) return false;
    const now = opts.now ?? Date.now();
    set({
      current: id,
      previous: current,
      switchedAt: now,
      cooldownUntil: now + MODE_SWITCH_COOLDOWN_MS,
      lastSwitch: { from: current, to: id, source, utterance: opts.utterance, at: now },
    });
    return true;
  },
  standby: (source, opts) => get().setMode(STANDBY, source, opts),
  wake: (source, opts) => {
    const { current, previous } = get();
    if (current !== STANDBY) return false;
    if (!WAKE_SOURCES.includes(source)) return false;
    const target: ModeId = previous && previous !== STANDBY ? previous : 'media';
    return get().setMode(target, source, opts);
  },
  gate: (now = Date.now()) => gestureGate(get().current, get().cooldownUntil, now),

  setVoice: (patch) => set((s) => ({ voice: { ...s.voice, ...patch } })),
  setTtsEnabled: (enabled) => {
    saveTtsEnabled(enabled);
    set({ ttsEnabled: enabled });
  },
}));

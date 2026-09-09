import { create } from 'zustand';
import type { GestureId } from '../gesture/types';

/** 실행 / 실행 실패 / 무시 (보완 2) */
export type LogResult = 'executed' | 'failed' | 'ignored';

export interface LogEntry {
  id: number;
  /** Date.now() */
  time: number;
  gesture: GestureId;
  result: LogResult;
  /** 실행한(하려던) 명령 이름 */
  command?: string;
  /** 무시 사유 또는 실패 사유 */
  reason?: string;
  /** 부가 정보 (진행률, 점수, 실행 결과 메시지 등) */
  note?: string;
}

export const LOG_LIMIT = 200;

const GESTURE_KO: Record<GestureId, string> = {
  open_palm: '손바닥',
  fist: '주먹',
  swipe_right: '오른쪽 스와이프',
  swipe_left: '왼쪽 스와이프',
  circle: '원',
};

export const RESULT_KO: Record<LogResult, string> = {
  executed: '실행',
  failed: '실행 실패',
  ignored: '무시',
};

function pad(n: number, w: number): string {
  return n.toString().padStart(w, '0');
}

export function formatTime(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}.${pad(d.getMilliseconds(), 3)}`;
}

/** 한 줄 형식: 시각 | 제스처 | 명령 | 결과 | 사유/비고. 화면·콘솔·복사 모두 이 형식을 쓴다. */
export function formatLogLine(e: LogEntry): string {
  const tail = [e.reason, e.note].filter(Boolean).join(' · ');
  return `${formatTime(e.time)} | ${GESTURE_KO[e.gesture]}(${e.gesture}) | ${e.command ?? '-'} | ${RESULT_KO[e.result]} | ${tail}`;
}

export function formatLog(entries: LogEntry[]): string {
  return ['시각 | 제스처 | 명령 | 결과 | 사유/비고', ...entries.map(formatLogLine)].join('\n');
}

interface LogState {
  /** 최신이 앞 */
  entries: LogEntry[];
  /** 콘솔 출력. 테스트에서 끈다 */
  sink: (line: string) => void;
  add: (entry: Omit<LogEntry, 'id' | 'time'> & { time?: number }) => LogEntry;
  clear: () => void;
}

let nextId = 1;

export const useLogStore = create<LogState>((set, get) => ({
  entries: [],
  sink: (line) => console.log(`[motion] ${line}`),
  add: (partial) => {
    const entry: LogEntry = { id: nextId++, time: partial.time ?? Date.now(), ...partial };
    get().sink(formatLogLine(entry));
    set((s) => ({ entries: [entry, ...s.entries].slice(0, LOG_LIMIT) }));
    return entry;
  },
  clear: () => set({ entries: [] }),
}));

import { create } from 'zustand';
import type { KeyCombo } from '../commands/keyPress';

/**
 * 데모 대상(target) 상태: 미디어 플레이어 핸들, 범용 카운트다운 타이머, 마지막으로 받은 키.
 * 명령(commands/catalog.ts)은 이 스토어를 통해서만 대상을 조작한다.
 * 특정 상황(요리 등)에 묶이지 않는다.
 */
export type TimerStatus = 'idle' | 'running' | 'done';

export interface TimerState {
  status: TimerStatus;
  durationMs: number;
  /** running일 때 종료 시각 (Date.now 기준) */
  endsAt: number;
  remainingMs: number;
}

export type PlayerPlaybackState = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';

/** 플레이어 컴포넌트가 등록하는 제어 핸들. 명령은 이것만 호출한다 */
export interface PlayerApi {
  play(): void;
  pause(): void;
  getState(): PlayerPlaybackState;
  /** 초 */
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number): void;
}

export interface LastKey {
  combo: KeyCombo;
  /** 실제 입력이면 true, 우리가 합성한 이벤트면 false */
  trusted: boolean;
  at: number;
}

export const DEFAULT_TIMER_MS = 3 * 60 * 1000;
export const DEFAULT_VIDEO_ID = 'VhJFyyukAzA';

interface TargetState {
  videoId: string;
  playerReady: boolean;
  playerState: PlayerPlaybackState;
  playerApi: PlayerApi | null;

  timer: TimerState;
  lastKey: LastKey | null;

  setVideoId: (id: string) => void;
  setPlayerApi: (api: PlayerApi | null) => void;
  setPlayerReady: (ready: boolean) => void;
  setPlayerState: (state: PlayerPlaybackState) => void;

  startTimer: (now: number, durationMs?: number) => void;
  stopTimer: () => void;
  /** 실행 중이면 정지, 아니면 durationMs로 시작. 무엇을 했는지 돌려준다 */
  toggleTimer: (now: number, durationMs?: number) => 'started' | 'stopped';
  /** 주기적으로 호출해 남은 시간을 갱신하고 종료를 감지한다 */
  tickTimer: (now: number) => void;

  setLastKey: (lastKey: LastKey) => void;
}

const idleTimer = (durationMs = DEFAULT_TIMER_MS): TimerState => ({
  status: 'idle',
  durationMs,
  endsAt: 0,
  remainingMs: durationMs,
});

export const useTargetStore = create<TargetState>((set, get) => ({
  videoId: DEFAULT_VIDEO_ID,
  playerReady: false,
  playerState: 'unstarted',
  playerApi: null,

  timer: idleTimer(),
  lastKey: null,

  setVideoId: (videoId) => set({ videoId, playerReady: false, playerState: 'unstarted' }),
  setPlayerApi: (playerApi) => set({ playerApi }),
  setPlayerReady: (playerReady) => set({ playerReady }),
  setPlayerState: (playerState) => set({ playerState }),

  startTimer: (now, durationMs = get().timer.durationMs) =>
    set({ timer: { status: 'running', durationMs, endsAt: now + durationMs, remainingMs: durationMs } }),
  stopTimer: () => set((s) => ({ timer: idleTimer(s.timer.durationMs) })),
  toggleTimer: (now, durationMs) => {
    if (get().timer.status === 'running') {
      get().stopTimer();
      return 'stopped';
    }
    get().startTimer(now, durationMs);
    return 'started';
  },
  tickTimer: (now) => {
    const t = get().timer;
    if (t.status !== 'running') return;
    const remaining = Math.max(0, t.endsAt - now);
    if (remaining === 0) set({ timer: { ...t, status: 'done', remainingMs: 0 } });
    else if (remaining !== t.remainingMs) set({ timer: { ...t, remainingMs: remaining } });
  },

  setLastKey: (lastKey) => set({ lastKey }),
}));

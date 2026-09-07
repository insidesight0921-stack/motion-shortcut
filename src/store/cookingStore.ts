import { create } from 'zustand';
import { SAMPLE_RECIPE, type Recipe } from '../modes/cooking/recipe';

export type TimerStatus = 'idle' | 'running' | 'done';

export interface TimerState {
  status: TimerStatus;
  durationMs: number;
  /** running일 때 종료 시각 (Date.now 기준) */
  endsAt: number;
  remainingMs: number;
}

export type PlayerPlaybackState = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';

/** YouTubePlayer 컴포넌트가 등록하는 제어 핸들. 명령은 이것만 호출한다. */
export interface PlayerApi {
  play(): void;
  pause(): void;
  getState(): PlayerPlaybackState;
}

export const TIMER_DURATION_MS = 3 * 60 * 1000;

interface CookingState {
  recipe: Recipe;
  stepIndex: number;
  videoId: string;
  timer: TimerState;
  playerReady: boolean;
  playerState: PlayerPlaybackState;
  playerApi: PlayerApi | null;

  /** 다음/이전 단계. 경계면 false */
  nextStep: () => boolean;
  prevStep: () => boolean;
  goToStep: (index: number) => void;

  startTimer: (now: number) => void;
  stopTimer: () => void;
  /** 실행 중이면 정지, 아니면 시작. 무엇을 했는지 돌려준다 */
  toggleTimer: (now: number) => 'started' | 'stopped';
  /** 주기적으로 호출해 남은 시간을 갱신하고 종료를 감지한다 */
  tickTimer: (now: number) => void;

  setVideoId: (id: string) => void;
  setPlayerApi: (api: PlayerApi | null) => void;
  setPlayerReady: (ready: boolean) => void;
  setPlayerState: (state: PlayerPlaybackState) => void;
}

const idleTimer = (): TimerState => ({
  status: 'idle',
  durationMs: TIMER_DURATION_MS,
  endsAt: 0,
  remainingMs: TIMER_DURATION_MS,
});

export const useCookingStore = create<CookingState>((set, get) => ({
  recipe: SAMPLE_RECIPE,
  stepIndex: 0,
  videoId: SAMPLE_RECIPE.videoId,
  timer: idleTimer(),
  playerReady: false,
  playerState: 'unstarted',
  playerApi: null,

  nextStep: () => {
    const { stepIndex, recipe } = get();
    if (stepIndex >= recipe.steps.length - 1) return false;
    set({ stepIndex: stepIndex + 1 });
    return true;
  },
  prevStep: () => {
    const { stepIndex } = get();
    if (stepIndex <= 0) return false;
    set({ stepIndex: stepIndex - 1 });
    return true;
  },
  goToStep: (index) => {
    const n = get().recipe.steps.length;
    set({ stepIndex: Math.max(0, Math.min(n - 1, index)) });
  },

  startTimer: (now) =>
    set({ timer: { status: 'running', durationMs: TIMER_DURATION_MS, endsAt: now + TIMER_DURATION_MS, remainingMs: TIMER_DURATION_MS } }),
  stopTimer: () => set({ timer: idleTimer() }),
  toggleTimer: (now) => {
    if (get().timer.status === 'running') {
      get().stopTimer();
      return 'stopped';
    }
    get().startTimer(now);
    return 'started';
  },
  tickTimer: (now) => {
    const t = get().timer;
    if (t.status !== 'running') return;
    const remaining = Math.max(0, t.endsAt - now);
    if (remaining === 0) set({ timer: { ...t, status: 'done', remainingMs: 0 } });
    else if (remaining !== t.remainingMs) set({ timer: { ...t, remainingMs: remaining } });
  },

  setVideoId: (videoId) => set({ videoId, playerReady: false, playerState: 'unstarted' }),
  setPlayerApi: (playerApi) => set({ playerApi }),
  setPlayerReady: (playerReady) => set({ playerReady }),
  setPlayerState: (playerState) => set({ playerState }),
}));

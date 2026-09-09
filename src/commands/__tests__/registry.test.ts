import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_GESTURES } from '../../gesture/types';
import { DEFAULT_MAPPING, cloneMapping } from '../../mapping/defaults';
import { DEFAULT_TIMER_MS, useTargetStore, type PlayerApi } from '../../store/targetStore';
import { ASSIGNABLE_COMMANDS, COMMANDS, defaultParams } from '../catalog';
import { isCommandId, runCommand, runMapping, validateParams } from '../registry';
import type { CommandContext } from '../types';

const ctx: CommandContext = { now: 1_000_000, toggleEnabled: vi.fn() };

function fakePlayer(initial: { state?: 'playing' | 'paused'; time?: number; duration?: number } = {}) {
  const calls: string[] = [];
  let state: 'playing' | 'paused' = initial.state ?? 'paused';
  let time = initial.time ?? 30;
  const api: PlayerApi = {
    play: () => {
      calls.push('play');
      state = 'playing';
    },
    pause: () => {
      calls.push('pause');
      state = 'paused';
    },
    getState: () => state,
    getCurrentTime: () => time,
    getDuration: () => initial.duration ?? 600,
    seekTo: (s) => {
      calls.push(`seek:${s}`);
      time = s;
    },
  };
  return { api, calls };
}

beforeEach(() => {
  useTargetStore.setState({
    playerApi: null,
    playerReady: false,
    playerState: 'unstarted',
    timer: { status: 'idle', durationMs: DEFAULT_TIMER_MS, endsAt: 0, remainingMs: DEFAULT_TIMER_MS },
  });
});

describe('카탈로그', () => {
  it('7개 명령이 있고 system.toggleEnabled 만 매핑 불가', () => {
    expect(Object.keys(COMMANDS)).toHaveLength(7);
    expect(ASSIGNABLE_COMMANDS.map((c) => c.id)).not.toContain('system.toggleEnabled');
    expect(ASSIGNABLE_COMMANDS).toHaveLength(6);
  });

  it('기본 파라미터는 스키마 기본값', () => {
    expect(defaultParams(COMMANDS['media.seekForward'])).toEqual({ seconds: 10 });
    expect(defaultParams(COMMANDS['timer.toggle'])).toEqual({ minutes: 3 });
    expect(defaultParams(COMMANDS['key.press'])).toEqual({ combo: 'ArrowRight' });
    expect(defaultParams(COMMANDS['media.playPause'])).toEqual({});
  });
});

describe('validateParams', () => {
  it('초·분 범위와 정수 검사', () => {
    const seek = COMMANDS['media.seekForward'];
    expect(validateParams(seek, { seconds: 10 })).toEqual({ ok: true, params: { seconds: 10 } });
    expect(validateParams(seek, { seconds: '15' })).toEqual({ ok: true, params: { seconds: 15 } });
    expect(validateParams(seek, { seconds: 0 }).ok).toBe(false);
    expect(validateParams(seek, { seconds: 601 }).ok).toBe(false);
    expect(validateParams(seek, { seconds: 2.5 }).ok).toBe(false);
    expect(validateParams(seek, { seconds: 'abc' }).ok).toBe(false);
    expect(validateParams(seek, {}).ok).toBe(false);
    const timer = COMMANDS['timer.toggle'];
    expect(validateParams(timer, { minutes: 180 }).ok).toBe(true);
    expect(validateParams(timer, { minutes: 181 }).ok).toBe(false);
  });

  it('키 조합 형식 검사', () => {
    const kp = COMMANDS['key.press'];
    expect(validateParams(kp, { combo: 'Shift+ArrowRight' })).toEqual({ ok: true, params: { combo: 'Shift+ArrowRight' } });
    expect(validateParams(kp, { combo: 'Shift' }).ok).toBe(false);
    expect(validateParams(kp, { combo: '' }).ok).toBe(false);
  });

  it('스키마에 없는 파라미터 키는 거부', () => {
    expect(validateParams(COMMANDS['media.playPause'], { seconds: 10 }).ok).toBe(false);
    expect(validateParams(COMMANDS['media.seekForward'], { seconds: 10, minutes: 3 }).ok).toBe(false);
  });
});

describe('runCommand', () => {
  it('알 수 없는 id 는 ok:false (throw 하지 않음)', () => {
    expect(isCommandId('media.explode')).toBe(false);
    expect(runCommand('media.explode', {}, ctx)).toEqual({ ok: false, message: '알 수 없는 명령: media.explode' });
  });

  it('media.* 는 플레이어 미준비 시 실행 실패 사유를 돌려준다 (보완 2)', () => {
    expect(runCommand('media.playPause', {}, ctx)).toEqual({ ok: false, message: '플레이어 준비 안 됨' });
    expect(runCommand('media.seekForward', { seconds: 10 }, ctx).ok).toBe(false);
    // 핸들은 있지만 ready 가 아니어도 실패
    useTargetStore.setState({ playerApi: fakePlayer().api, playerReady: false });
    expect(runCommand('media.playPause', {}, ctx).ok).toBe(false);
  });

  it('재생/일시정지 토글', () => {
    const p = fakePlayer({ state: 'paused' });
    useTargetStore.setState({ playerApi: p.api, playerReady: true });
    expect(runCommand('media.playPause', {}, ctx)).toEqual({ ok: true, message: '재생' });
    expect(runCommand('media.playPause', {}, ctx)).toEqual({ ok: true, message: '일시정지' });
    expect(p.calls).toEqual(['play', 'pause']);
  });

  it('앞으로/뒤로 이동은 현재 위치 ± n초, 0과 길이로 잘린다', () => {
    const p = fakePlayer({ time: 30, duration: 45 });
    useTargetStore.setState({ playerApi: p.api, playerReady: true });
    expect(runCommand('media.seekForward', { seconds: 10 }, ctx).ok).toBe(true);
    expect(runCommand('media.seekForward', { seconds: 10 }, ctx).ok).toBe(true); // 40 + 10 → 45 로 잘림
    expect(runCommand('media.seekBackward', { seconds: 60 }, ctx).ok).toBe(true); // → 0
    expect(p.calls).toEqual(['seek:40', 'seek:45', 'seek:0']);
  });

  it('timer.toggle 은 분 단위로 시작하고 다시 부르면 정지', () => {
    expect(runCommand('timer.toggle', { minutes: 5 }, ctx)).toEqual({ ok: true, message: '5분 타이머 시작' });
    const t = useTargetStore.getState().timer;
    expect(t.status).toBe('running');
    expect(t.durationMs).toBe(5 * 60_000);
    expect(t.endsAt).toBe(ctx.now + 5 * 60_000);
    expect(runCommand('timer.toggle', { minutes: 5 }, { ...ctx, now: ctx.now + 1000 })).toEqual({ ok: true, message: '타이머 정지' });
    expect(useTargetStore.getState().timer.status).toBe('idle');
  });

  it('검증에 실패한 파라미터로는 실행하지 않는다', () => {
    const r = runCommand('timer.toggle', { minutes: 999 }, ctx);
    expect(r.ok).toBe(false);
    expect(useTargetStore.getState().timer.status).toBe('idle');
  });

  it('system.toggleEnabled 는 상태를 바꾸지 않고 메시지만 돌려준다 (토글은 엔진 담당)', () => {
    const toggle = vi.fn();
    expect(runCommand('system.toggleEnabled', {}, { now: 0, toggleEnabled: toggle }).ok).toBe(true);
    expect(toggle).not.toHaveBeenCalled();
  });
});

describe('runMapping', () => {
  it('기본 매핑: 5개 제스처 모두 항목이 있고 주먹은 system.toggleEnabled', () => {
    for (const g of ALL_GESTURES) expect(DEFAULT_MAPPING[g]).toBeDefined();
    expect(DEFAULT_MAPPING.fist.commandId).toBe('system.toggleEnabled');
    expect(DEFAULT_MAPPING.open_palm.commandId).toBe('media.playPause');
    expect(DEFAULT_MAPPING.swipe_right).toEqual({ commandId: 'media.seekForward', params: { seconds: 10 } });
    expect(DEFAULT_MAPPING.swipe_left).toEqual({ commandId: 'media.seekBackward', params: { seconds: 10 } });
    expect(DEFAULT_MAPPING.circle).toEqual({ commandId: 'timer.toggle', params: { minutes: 3 } });
  });

  it('실행 / 실행 실패 / 무시 세 종류로 구분된다 (보완 2)', () => {
    const m = cloneMapping(DEFAULT_MAPPING);
    // 플레이어 미준비 → failed
    const failed = runMapping(m, 'open_palm', ctx);
    expect(failed.status).toBe('failed');
    expect(failed.message).toBe('플레이어 준비 안 됨');
    // 타이머 → executed
    expect(runMapping(m, 'circle', ctx).status).toBe('executed');
    // none → ignored
    m.swipe_left = { commandId: 'none', params: {} };
    const ignored = runMapping(m, 'swipe_left', ctx);
    expect(ignored.status).toBe('ignored');
    expect(ignored.message).toBe('명령 없음');
  });

  it('키 캡처 중에는 매핑 실행이 일시 중지된다 (보완 1)', () => {
    const p = fakePlayer();
    useTargetStore.setState({ playerApi: p.api, playerReady: true });
    const r = runMapping(DEFAULT_MAPPING, 'open_palm', ctx, { paused: true, pausedReason: '키 캡처 중' });
    expect(r.status).toBe('ignored');
    expect(r.message).toBe('키 캡처 중');
    expect(p.calls).toEqual([]);
    const after = runMapping(DEFAULT_MAPPING, 'open_palm', ctx, { paused: false });
    expect(after.status).toBe('executed');
  });

  it('알 수 없는 명령 id 가 들어 있으면 무시', () => {
    const m = cloneMapping(DEFAULT_MAPPING);
    (m.circle as { commandId: string }).commandId = 'bogus';
    expect(runMapping(m, 'circle', ctx).status).toBe('ignored');
  });
});

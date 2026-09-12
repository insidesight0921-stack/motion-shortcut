import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAsyncFailureHandler, setKeyTransport, type KeyTransport } from '../../agent/dispatch';
import { ALL_GESTURES } from '../../gesture/types';
import { cloneMapping } from '../../mapping/defaults';
import { defaultSlideMapping } from '../../profile/defaults';
import { ASSIGNABLE_COMMANDS, COMMANDS, defaultParams } from '../catalog';
import { setProgramProvider } from '../programProvider';
import { isCommandId, runCommand, runMapping, validateParams } from '../registry';
import type { CommandContext } from '../types';

const ctx: CommandContext = { now: 1_000_000, toggleEnabled: vi.fn() };

function fakeTransport(platform: 'darwin' | 'win32' = 'darwin') {
  const sent: string[] = [];
  const t: KeyTransport = { canSend: () => true, platform: () => platform, sendKey: (c) => (sent.push(c), Promise.resolve()) };
  return { t, sent };
}

beforeEach(() => setProgramProvider(() => 'powerpoint'));
afterEach(() => {
  setKeyTransport(null);
  setAsyncFailureHandler(null);
});

describe('카탈로그', () => {
  it('slide 7개 + key.press + none + system.toggleEnabled = 10개, system 만 매핑 불가', () => {
    expect(Object.keys(COMMANDS)).toHaveLength(10);
    expect(ASSIGNABLE_COMMANDS.map((c) => c.id)).not.toContain('system.toggleEnabled');
    expect(ASSIGNABLE_COMMANDS).toHaveLength(9);
    expect(COMMANDS['slide.return'].risk).toBe('high');
    expect(COMMANDS['slide.next'].risk).toBe('low');
  });

  it('기본 파라미터는 스키마 기본값', () => {
    expect(defaultParams(COMMANDS['slide.goto'])).toEqual({ slide: 1 });
    expect(defaultParams(COMMANDS['key.press'])).toEqual({ combo: 'ArrowRight' });
    expect(defaultParams(COMMANDS['slide.next'])).toEqual({});
  });
});

describe('validateParams', () => {
  it('slide.goto 번호 범위와 정수 검사', () => {
    const g = COMMANDS['slide.goto'];
    expect(validateParams(g, { slide: 12 })).toEqual({ ok: true, params: { slide: 12 } });
    expect(validateParams(g, { slide: '7' })).toEqual({ ok: true, params: { slide: 7 } });
    expect(validateParams(g, { slide: 0 }).ok).toBe(false);
    expect(validateParams(g, { slide: 501 }).ok).toBe(false);
    expect(validateParams(g, { slide: 2.5 }).ok).toBe(false);
    expect(validateParams(g, {}).ok).toBe(false);
  });

  it('키 조합 형식 검사', () => {
    const kp = COMMANDS['key.press'];
    expect(validateParams(kp, { combo: 'Shift+ArrowRight' })).toEqual({ ok: true, params: { combo: 'Shift+ArrowRight' } });
    expect(validateParams(kp, { combo: 'Shift' }).ok).toBe(false);
    expect(validateParams(kp, { combo: '' }).ok).toBe(false);
  });

  it('스키마에 없는 파라미터 키는 거부', () => {
    expect(validateParams(COMMANDS['slide.next'], { slide: 3 }).ok).toBe(false);
    expect(validateParams(COMMANDS['slide.goto'], { slide: 3, combo: 'A' }).ok).toBe(false);
  });
});

describe('runCommand (실행 출구: 에이전트 우선, 페이지 폴백)', () => {
  it('알 수 없는 id 는 ok:false (throw 하지 않음)', () => {
    expect(isCommandId('media.playPause')).toBe(false);
    expect(runCommand('media.playPause', {}, ctx)).toEqual({ ok: false, message: '알 수 없는 명령: media.playPause' });
  });

  it('slide.next 는 활성 프로그램·플랫폼의 키를 에이전트로 보낸다', () => {
    const { t, sent } = fakeTransport('win32');
    setKeyTransport(t);
    setProgramProvider(() => 'powerpoint');
    const r = runCommand('slide.next', {}, ctx);
    expect(r.ok).toBe(true);
    expect(sent).toEqual(['ArrowRight']);
    expect(r.message).toBe('다음 슬라이드 (ArrowRight) · 에이전트');
  });

  it('slide.start 는 프로그램·플랫폼별 조합', () => {
    const { t, sent } = fakeTransport('darwin');
    setKeyTransport(t);
    setProgramProvider(() => 'keynote');
    expect(runCommand('slide.start', {}, ctx).ok).toBe(true);
    setProgramProvider(() => 'google-slides');
    expect(runCommand('slide.start', {}, ctx).ok).toBe(true);
    expect(sent).toEqual(['Alt+Meta+P', 'Meta+Enter']);
  });

  it('slide.goto 는 자릿수 + Enter 를 순서대로', () => {
    const { t, sent } = fakeTransport();
    setKeyTransport(t);
    expect(runCommand('slide.goto', { slide: 12 }, ctx).ok).toBe(true);
    expect(sent).toEqual(['1', '2', 'Enter']);
  });

  it('검증에 실패한 파라미터로는 아무것도 보내지 않는다', () => {
    const { t, sent } = fakeTransport();
    setKeyTransport(t);
    expect(runCommand('slide.goto', { slide: 999 }, ctx).ok).toBe(false);
    expect(sent).toEqual([]);
  });

  it('에이전트가 없으면 페이지 안 폴백 경로로 간다 (node 에는 DOM 이 없어 실패로 보고)', () => {
    const r = runCommand('slide.next', {}, ctx);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('DOM 없음');
  });

  it('key.press 도 같은 출구를 쓴다', () => {
    const { t, sent } = fakeTransport();
    setKeyTransport(t);
    expect(runCommand('key.press', { combo: 'Shift+K' }, ctx)).toEqual({ ok: true, message: 'Shift+K → 에이전트' });
    expect(sent).toEqual(['Shift+K']);
  });

  it('system.toggleEnabled 는 상태를 바꾸지 않고 메시지만 돌려준다 (토글은 엔진 담당)', () => {
    const toggle = vi.fn();
    expect(runCommand('system.toggleEnabled', {}, { now: 0, toggleEnabled: toggle }).ok).toBe(true);
    expect(toggle).not.toHaveBeenCalled();
  });
});

describe('runMapping', () => {
  it('기본 슬라이드 매핑: 5개 제스처 모두 항목이 있고 주먹은 system.toggleEnabled', () => {
    const m = defaultSlideMapping('powerpoint');
    for (const g of ALL_GESTURES) expect(m[g]).toBeDefined();
    expect(m.fist.commandId).toBe('system.toggleEnabled');
    expect(m.swipe_right.commandId).toBe('slide.next');
    expect(m.swipe_left.commandId).toBe('slide.prev');
    expect(m.open_palm.commandId).toBe('slide.blackout');
    expect(m.circle.commandId).toBe('slide.return');
  });

  it('실행 / 실행 실패 / 무시 세 종류로 구분된다', () => {
    const m = cloneMapping(defaultSlideMapping('powerpoint'));
    // 에이전트 없음 + node(DOM 없음) → failed
    expect(runMapping(m, 'swipe_right', ctx).status).toBe('failed');
    // 에이전트 있음 → executed
    const { t } = fakeTransport();
    setKeyTransport(t);
    expect(runMapping(m, 'swipe_right', ctx).status).toBe('executed');
    // none → ignored
    m.swipe_left = { commandId: 'none', params: {} };
    const ignored = runMapping(m, 'swipe_left', ctx);
    expect(ignored.status).toBe('ignored');
    expect(ignored.message).toBe('명령 없음');
  });

  it('키 캡처 중에는 매핑 실행이 일시 중지된다', () => {
    const { t, sent } = fakeTransport();
    setKeyTransport(t);
    const r = runMapping(defaultSlideMapping('powerpoint'), 'swipe_right', ctx, { paused: true, pausedReason: '키 캡처 중' });
    expect(r.status).toBe('ignored');
    expect(r.message).toBe('키 캡처 중');
    expect(sent).toEqual([]);
  });

  it('알 수 없는 명령 id 가 들어 있으면 무시', () => {
    const m = cloneMapping(defaultSlideMapping('powerpoint'));
    (m.circle as { commandId: string }).commandId = 'bogus';
    expect(runMapping(m, 'circle', ctx).status).toBe('ignored');
  });
});

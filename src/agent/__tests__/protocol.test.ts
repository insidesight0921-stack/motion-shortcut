import { describe, expect, it } from 'vitest';
import { describeAgentError, encodeRequest, isFireAndForget, parseAgentMessage } from '../protocol';

describe('parseAgentMessage', () => {
  it('hello 를 정규화한다 (모르는 capability 는 버림, 권한 기본값)', () => {
    const m = parseAgentMessage(JSON.stringify({ v: 1, type: 'hello', agent: 'x/1', platform: 'darwin', capabilities: ['key', 'teleport', 'panel'], permissions: { accessibility: true } }));
    expect(m).toEqual({ v: 1, type: 'hello', agent: 'x/1', platform: 'darwin', capabilities: ['key', 'panel'], permissions: { accessibility: true, screenRecording: null }, displays: undefined });
  });

  it('ack / nack / permissions / panic / pong', () => {
    expect(parseAgentMessage('{"v":1,"id":"a","ok":true}')).toEqual({ v: 1, id: 'a', ok: true });
    expect(parseAgentMessage('{"v":1,"id":"a","ok":false,"error":"not_whitelisted","message":"x"}')).toEqual({ v: 1, id: 'a', ok: false, error: 'not_whitelisted', message: 'x' });
    expect(parseAgentMessage('{"v":1,"type":"permissions","permissions":{"accessibility":false}}')).toEqual({ v: 1, type: 'permissions', permissions: { accessibility: false, screenRecording: null } });
    expect(parseAgentMessage('{"v":1,"type":"panic"}')).toEqual({ v: 1, type: 'panic' });
    expect(parseAgentMessage('{"v":1,"type":"pong","id":"p"}')).toEqual({ v: 1, type: 'pong', id: 'p' });
  });

  it('버전 불일치·형식 오류·모르는 type 은 null', () => {
    expect(parseAgentMessage('{"v":2,"type":"hello"}')).toBeNull();
    expect(parseAgentMessage('not json')).toBeNull();
    expect(parseAgentMessage('{"v":1,"type":"delete_everything"}')).toBeNull();
    expect(parseAgentMessage('{"v":1,"type":"hello","platform":"amiga"}')).toBeNull();
  });
});

describe('encodeRequest / isFireAndForget', () => {
  it('v 와 id 를 붙인다', () => {
    const { id, text } = encodeRequest({ type: 'key', combo: 'ArrowRight' }, 'fixed');
    expect(id).toBe('fixed');
    expect(JSON.parse(text)).toEqual({ v: 1, id: 'fixed', type: 'key', combo: 'ArrowRight' });
  });

  it('ack:false 인 move 만 응답을 기다리지 않는다', () => {
    expect(isFireAndForget({ type: 'cursor', action: 'move', x: 0.1, y: 0.2, ack: false })).toBe(true);
    expect(isFireAndForget({ type: 'laser', action: 'move', x: 0.1, y: 0.2, ack: false })).toBe(true);
    expect(isFireAndForget({ type: 'cursor', action: 'click', button: 'left' })).toBe(false);
    expect(isFireAndForget({ type: 'key', combo: 'B' })).toBe(false);
  });
});

describe('describeAgentError', () => {
  it('알려진 코드는 한국어 라벨, 모르는 코드는 원문', () => {
    expect(describeAgentError('accessibility_permission_missing')).toBe('손쉬운 사용 권한 없음');
    expect(describeAgentError('internal', 'panic')).toBe('에이전트 내부 오류 · panic');
    expect(describeAgentError('weird')).toBe('에이전트 오류 (weird)');
  });
});

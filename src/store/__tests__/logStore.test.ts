import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatLog, formatLogLine, LOG_LIMIT, useLogStore } from '../logStore';

beforeEach(() => {
  useLogStore.setState({ entries: [], sink: () => undefined });
});

describe('logStore', () => {
  it('최신 항목이 앞에 오고 콘솔 싱크가 같은 줄을 받는다', () => {
    const sink = vi.fn();
    useLogStore.setState({ sink });
    const a = useLogStore.getState().add({ gesture: 'open_palm', result: 'executed', command: '영상 재생/일시정지', time: 0 });
    useLogStore.getState().add({ gesture: 'circle', result: 'ignored', reason: '쿨다운 중', time: 1 });
    const entries = useLogStore.getState().entries;
    expect(entries[0].gesture).toBe('circle');
    expect(entries[1].id).toBe(a.id);
    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink.mock.calls[0][0]).toBe(formatLogLine(a));
  });

  it('LOG_LIMIT을 넘으면 오래된 것부터 버린다', () => {
    for (let i = 0; i < LOG_LIMIT + 20; i++) useLogStore.getState().add({ gesture: 'fist', result: 'executed', time: i });
    const entries = useLogStore.getState().entries;
    expect(entries).toHaveLength(LOG_LIMIT);
    expect(entries[0].time).toBe(LOG_LIMIT + 19);
  });

  it('한 줄 형식은 시각 | 제스처 | 명령 | 결과 | 사유', () => {
    const line = formatLogLine({ id: 1, time: new Date(2026, 8, 7, 14, 5, 9, 42).getTime(), gesture: 'swipe_right', result: 'failed', command: '앞으로 이동', reason: '플레이어 준비 안 됨' });
    expect(line).toBe('14:05:09.042 | 오른쪽 스와이프(swipe_right) | 앞으로 이동 | 실행 실패 | 플레이어 준비 안 됨');
  });

  it('formatLog은 헤더를 붙인다', () => {
    useLogStore.getState().add({ gesture: 'fist', result: 'executed', command: '활성화 OFF', time: 0 });
    const text = formatLog(useLogStore.getState().entries);
    expect(text.split('\n')[0]).toBe('시각 | 제스처/주체 | 명령 | 결과 | 사유/비고');
    expect(text.split('\n')).toHaveLength(2);
  });

  it('제스처가 아닌 항목(모드 전환)은 subject 를 주체로 쓴다', () => {
    const line = formatLogLine({ id: 1, time: new Date(2026, 8, 9, 9, 0, 0, 0).getTime(), subject: '모드 전환', result: 'executed', command: 'media → presentation', note: '음성 "발표 모드"' });
    expect(line).toBe('09:00:00.000 | 모드 전환 | media → presentation | 실행 | 음성 "발표 모드"');
  });
});

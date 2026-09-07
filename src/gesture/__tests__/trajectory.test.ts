import { describe, expect, it } from 'vitest';
import { TrajectoryBuffer } from '../trajectory';
import type { HandFrame } from '../types';
import { openHand } from './fixtures';

const frame = (t: number): HandFrame => ({ t, landmarks: openHand(), score: 0.9 });

describe('TrajectoryBuffer', () => {
  it('오래된 프레임을 maxAge 기준으로 버린다', () => {
    const buf = new TrajectoryBuffer(1000);
    for (let t = 0; t <= 2000; t += 100) buf.push(frame(t));
    const all = buf.window(10_000, 2000);
    expect(all[0].t).toBe(1000);
    expect(all[all.length - 1].t).toBe(2000);
  });

  it('window는 now 기준 최근 ms만 오래된 순으로 준다', () => {
    const buf = new TrajectoryBuffer(5000);
    for (let t = 0; t <= 1000; t += 50) buf.push(frame(t));
    const w = buf.window(300, 1000);
    expect(w.map((f) => f.t)).toEqual([700, 750, 800, 850, 900, 950, 1000]);
  });

  it('타임스탬프가 역행하는 프레임은 무시한다', () => {
    const buf = new TrajectoryBuffer(5000);
    buf.push(frame(100));
    buf.push(frame(100));
    buf.push(frame(50));
    expect(buf.length).toBe(1);
  });

  it('clear 후에는 비어 있다', () => {
    const buf = new TrajectoryBuffer(5000);
    buf.push(frame(0));
    buf.clear();
    expect(buf.length).toBe(0);
    expect(buf.latest()).toBeNull();
  });
});

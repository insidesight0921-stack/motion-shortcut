import { describe, expect, it } from 'vitest';
import { formatMs } from '../timer/formatMs';
import { parseYouTubeId } from '../youtube/youtubeId';

describe('formatMs', () => {
  it('m:ss 형식, 올림', () => {
    expect(formatMs(180_000)).toBe('3:00');
    expect(formatMs(59_001)).toBe('1:00');
    expect(formatMs(5_000)).toBe('0:05');
    expect(formatMs(0)).toBe('0:00');
  });
});

describe('parseYouTubeId', () => {
  it('ID, watch URL, youtu.be, shorts, embed를 인식한다', () => {
    expect(parseYouTubeId('VhJFyyukAzA')).toBe('VhJFyyukAzA');
    expect(parseYouTubeId('https://www.youtube.com/watch?v=VhJFyyukAzA&t=10s')).toBe('VhJFyyukAzA');
    expect(parseYouTubeId('https://youtu.be/VhJFyyukAzA')).toBe('VhJFyyukAzA');
    expect(parseYouTubeId('https://www.youtube.com/shorts/WAle9soKZx8')).toBe('WAle9soKZx8');
    expect(parseYouTubeId('https://www.youtube.com/embed/VhJFyyukAzA')).toBe('VhJFyyukAzA');
  });

  it('엉뚱한 입력은 null', () => {
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId('hello world')).toBeNull();
    expect(parseYouTubeId('https://example.com/watch?v=VhJFyyukAzA')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/')).toBeNull();
  });
});

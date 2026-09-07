/**
 * WebAudio 오실레이터로 만드는 짧은 효과음. 에셋 파일 없음.
 * AudioContext는 사용자 입력(클릭) 뒤에만 소리를 낼 수 있으므로 unlockAudio()를
 * 첫 클릭(카메라 시작 등)에서 호출한다.
 */
export type SoundKind = 'execute' | 'toggleOn' | 'toggleOff' | 'timerDone';

let ctx: AudioContext | null = null;
let muted = false;

export function unlockAudio(): void {
  if (typeof AudioContext === 'undefined') return;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

function tone(freq: number, durationMs: number, offsetMs = 0, type: OscillatorType = 'sine', gain = 0.12): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + offsetMs / 1000;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

export function playSound(kind: SoundKind): void {
  if (muted || !ctx) return;
  switch (kind) {
    case 'execute':
      tone(880, 90);
      tone(1320, 120, 90);
      break;
    case 'toggleOn':
      tone(660, 90);
      tone(990, 140, 100);
      break;
    case 'toggleOff':
      tone(660, 90);
      tone(440, 160, 100);
      break;
    case 'timerDone':
      for (let i = 0; i < 3; i++) tone(1046, 180, i * 260, 'triangle', 0.18);
      break;
  }
}

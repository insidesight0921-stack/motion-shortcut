/**
 * speechSynthesis 래퍼. 모드 전환 확인음("발표 모드") 1회에만 쓴다.
 * ko-KR 음성이 없으면 발화를 건너뛰고 배지 변경만 남긴다 (보완 2).
 */
export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function isKorean(v: SpeechSynthesisVoice): boolean {
  return v.lang.replace('_', '-').toLowerCase().startsWith('ko');
}

export function getKoreanVoice(): SpeechSynthesisVoice | null {
  if (!isTtsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => isKorean(v) && v.default) ?? voices.find(isKorean) ?? null;
}

export function hasKoreanVoice(): boolean {
  return getKoreanVoice() !== null;
}

/**
 * 음성 목록은 비동기로 채워진다(voiceschanged). 지금 값으로 한 번, 바뀔 때마다 다시 알려 준다.
 * 반환값은 구독 해제 함수.
 */
export function onVoicesReady(cb: (available: boolean) => void): () => void {
  if (!isTtsSupported()) {
    cb(false);
    return () => undefined;
  }
  const notify = () => cb(hasKoreanVoice());
  notify();
  window.speechSynthesis.addEventListener('voiceschanged', notify);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', notify);
}

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * 한국어로 말한다. 말할 수 없으면(미지원·한국어 음성 없음) false 를 돌려주고 onEnd 를 바로 부른다.
 * 이전 발화가 남아 있으면 취소한다(전환이 연달아 일어나면 마지막 것만).
 */
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  const voice = getKoreanVoice();
  if (!voice) {
    opts.onEnd?.();
    return false;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 1;
  u.pitch = 1;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    opts.onEnd?.();
  };
  u.onstart = () => opts.onStart?.();
  u.onend = end;
  u.onerror = end;
  synth.speak(u);
  // 일부 브라우저는 cancel 직후 onend 를 안 주는 경우가 있어 안전장치
  window.setTimeout(end, 4000);
  return true;
}

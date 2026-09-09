/**
 * Web Speech API 인식기 래퍼. 모드 전환·대기 해제에만 쓴다 (명령 실행 없음, D-016).
 *
 * 규칙:
 *  - window.SpeechRecognition ?? window.webkitSpeechRecognition. 없으면 unsupported (앱은 정상 동작).
 *  - lang ko-KR, continuous, interimResults=false, maxAlternatives=3.
 *  - onend 자동 재시작 (사용자가 껐거나 TTS 로 잠시 멈춘 경우 제외). 연속 실패 3회면 error 로 멈춘다.
 *  - 시작은 사용자 클릭에서만 (마이크 권한 자동 요청 금지).
 *  - Chrome 의 인식은 Google 서버를 거친다. 오프라인이면 'network' 오류가 난다.
 */
export type RecognizerStatus = 'unsupported' | 'off' | 'requesting' | 'listening' | 'denied' | 'error';

export interface RecognizerEvents {
  onStatus: (status: RecognizerStatus, error?: string) => void;
  /** isFinal 결과의 대안(최대 3개, 신뢰도 순) */
  onResult: (alternatives: string[]) => void;
}

export const MAX_RESTART_FAILURES = 3;

const ERROR_MESSAGES: Record<string, string> = {
  network: '오프라인이거나 Google 음성 서버에 연결할 수 없습니다. 인식은 온라인에서만 동작합니다.',
  'audio-capture': '마이크를 찾지 못했습니다. 마이크가 연결돼 있는지 확인하세요.',
  'language-not-supported': '이 브라우저는 한국어(ko-KR) 인식을 지원하지 않습니다.',
  'service-not-allowed': '브라우저가 음성 인식 서비스를 막고 있습니다.',
};

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export class VoiceRecognizer {
  private rec: SpeechRecognitionLike | null = null;
  private wanted = false; // 사용자가 켜 두었는가
  private paused = false; // TTS 발화 중 일시 정지
  private failures = 0;
  status: RecognizerStatus;

  constructor(private events: RecognizerEvents) {
    this.status = getSpeechRecognitionCtor() ? 'off' : 'unsupported';
  }

  static isSupported(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  private setStatus(status: RecognizerStatus, error?: string): void {
    this.status = status;
    this.events.onStatus(status, error);
  }

  /** 사용자 클릭에서 호출. 여기서 처음 마이크 권한을 요청한다 */
  start(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.setStatus('unsupported');
      return;
    }
    this.wanted = true;
    this.paused = false;
    this.failures = 0;
    this.setStatus('requesting');
    this.launch(Ctor);
  }

  /** 사용자가 끔. 자동 재시작하지 않는다 */
  stop(): void {
    this.wanted = false;
    this.paused = false;
    this.teardown();
    this.setStatus('off');
  }

  /** TTS 가 말하는 동안 자기 목소리를 듣지 않도록 잠시 멈춘다 */
  pause(): void {
    if (!this.wanted || this.paused) return;
    this.paused = true;
    this.teardown();
  }

  resume(): void {
    if (!this.wanted || !this.paused) return;
    this.paused = false;
    const Ctor = getSpeechRecognitionCtor();
    if (Ctor) this.launch(Ctor);
  }

  private teardown(): void {
    const r = this.rec;
    this.rec = null;
    if (!r) return;
    r.onend = null;
    r.onresult = null;
    r.onerror = null;
    r.onstart = null;
    try {
      r.abort();
    } catch {
      // 이미 멈춘 상태
    }
  }

  private launch(Ctor: new () => SpeechRecognitionLike): void {
    this.teardown();
    const r = new Ctor();
    r.lang = 'ko-KR';
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;

    r.onstart = () => {
      this.failures = 0;
      this.setStatus('listening');
    };

    r.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        if (!result.isFinal) continue;
        const alternatives: string[] = [];
        for (let j = 0; j < result.length; j++) {
          const t = result[j]?.transcript?.trim();
          if (t) alternatives.push(t);
        }
        if (alternatives.length) this.events.onResult(alternatives);
      }
    };

    r.onerror = (ev) => {
      const code = ev.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        // 권한 거부: 재시작해도 소용없다
        this.wanted = false;
        this.teardown();
        this.setStatus('denied', ERROR_MESSAGES[code] ?? '마이크 권한이 없습니다.');
        return;
      }
      if (code === 'no-speech' || code === 'aborted') return; // 침묵·중단은 onend 재시작으로 처리
      this.failures++;
      const message = ERROR_MESSAGES[code] ?? `음성 인식 오류 (${code})`;
      if (this.failures >= MAX_RESTART_FAILURES) {
        this.wanted = false;
        this.teardown();
        this.setStatus('error', message);
      } else {
        this.setStatus('requesting', message);
      }
    };

    r.onend = () => {
      if (this.rec !== r) return; // 이미 교체됨
      this.rec = null;
      if (!this.wanted || this.paused) return;
      // Chrome 은 침묵이 길면 continuous 여도 끝난다. 자동 재시작.
      try {
        this.launch(Ctor);
      } catch (err) {
        this.failures++;
        if (this.failures >= MAX_RESTART_FAILURES) {
          this.wanted = false;
          this.setStatus('error', `재시작에 ${MAX_RESTART_FAILURES}회 연속 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    };

    this.rec = r;
    try {
      r.start();
    } catch (err) {
      // 같은 인스턴스를 두 번 start 하면 InvalidStateError. 실패로 센다
      this.failures++;
      if (this.failures >= MAX_RESTART_FAILURES) {
        this.wanted = false;
        this.teardown();
        this.setStatus('error', `음성 인식을 시작하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

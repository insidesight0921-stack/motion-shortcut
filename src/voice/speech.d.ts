// TypeScript lib.dom(5.9)에는 SpeechRecognitionResult/ResultList/Alternative 만 있고
// SpeechRecognition 본체와 이벤트 타입, webkit 접두사 생성자가 없다. 필요한 최소만 선언한다.

interface SpeechRecognitionEventLike extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEventLike extends Event {
  /** 'not-allowed' | 'service-not-allowed' | 'network' | 'no-speech' | 'audio-capture' | 'aborted' | 'language-not-supported' … */
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

import { useEffect, useRef } from 'react';
import { MODES } from '../modes/catalog';
import { useModeStore } from '../store/modeStore';
import { describeIntent, match } from '../voice/keywords';
import { VoiceRecognizer } from '../voice/recognizer';
import { onVoicesReady, speak } from '../voice/tts';
import { logModeSwitch, logVoiceIgnored } from './modeLog';

export interface VoiceControls {
  start: () => void;
  stop: () => void;
}

/**
 * 음성 인식기 ↔ 모드 스토어 연결.
 *  - 인식 결과(대안 3개) → keywords.match → setMode/standby/wake('voice')
 *  - 모드 전환(어느 경로든) → 실행 로그 + TTS "<모드> 모드" 1회. TTS 동안 인식기를 멈춰 되먹임을 막는다.
 *  - ko-KR 음성 유무를 voice.ttsAvailable 에 반영 (보완 2)
 */
export function useVoice(): VoiceControls {
  const recRef = useRef<VoiceRecognizer | null>(null);

  useEffect(() => {
    const setVoice = useModeStore.getState().setVoice;
    const rec = new VoiceRecognizer({
      onStatus: (status, error) => setVoice({ status, error }),
      onResult: (alternatives) => {
        const store = useModeStore.getState();
        const inStandby = store.current === 'standby';
        const hit = match(alternatives, { inStandby });
        const heard = alternatives[0] ?? '';
        if (!hit) {
          setVoice({ lastUtterance: heard, lastIntent: '의도 없음' });
          logVoiceIgnored(heard, '인식됨 · 의도 없음');
          return;
        }
        setVoice({ lastUtterance: hit.utterance, lastIntent: describeIntent(hit.intent) });
        const opts = { utterance: hit.utterance };
        let changed = false;
        if (hit.intent.kind === 'switch') changed = store.setMode(hit.intent.mode, 'voice', opts);
        else if (hit.intent.kind === 'standby') changed = store.standby('voice', opts);
        else changed = store.wake('voice', opts);
        if (!changed) {
          const why = hit.intent.kind === 'wake' && !inStandby ? '이미 활성 상태' : hit.intent.kind === 'switch' ? '이미 그 모드' : '이미 대기 중';
          logVoiceIgnored(hit.utterance, why);
        }
      },
    });
    recRef.current = rec;
    setVoice({ status: rec.status });

    const offVoices = onVoicesReady((available) => setVoice({ ttsAvailable: available }));

    // 모드 전환 효과: 로그 + TTS (전환 경로와 무관하게 한 곳에서)
    let lastAt = useModeStore.getState().lastSwitch?.at ?? 0;
    const offSwitch = useModeStore.subscribe((s) => {
      const sw = s.lastSwitch;
      if (!sw || sw.at === lastAt) return;
      lastAt = sw.at;
      logModeSwitch(sw);
      if (!s.ttsEnabled || !s.voice.ttsAvailable) return;
      rec.pause();
      const text = sw.to === 'standby' ? '모션 꺼짐' : `${MODES[sw.to].name} 모드`;
      const spoke = speak(text, { onEnd: () => rec.resume() });
      if (!spoke) rec.resume();
    });

    return () => {
      offVoices();
      offSwitch();
      rec.stop();
      recRef.current = null;
    };
  }, []);

  return {
    start: () => recRef.current?.start(),
    stop: () => recRef.current?.stop(),
  };
}

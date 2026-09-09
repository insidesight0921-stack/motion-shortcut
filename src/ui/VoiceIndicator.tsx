import { useModeStore, type VoiceStatus } from '../store/modeStore';
import { IconMic, IconMicOff, StatusDot } from './icons';
import type { VoiceControls } from './useVoice';

const STATUS_LABEL: Record<VoiceStatus, string> = {
  unsupported: '음성 미지원',
  off: '음성 꺼짐',
  requesting: '마이크 준비 중',
  listening: '듣는 중',
  denied: '마이크 권한 없음',
  error: '음성 오류',
};

interface Props {
  controls: VoiceControls;
}

/**
 * 음성 상태 표시 + 켜기/끄기. 음성은 모드 전환·대기 해제에만 쓴다.
 * denied 에서는 버튼 대신 권한 복구 안내를 보여 준다 (보완 3).
 */
export function VoiceIndicator({ controls }: Props) {
  const voice = useModeStore((s) => s.voice);
  const ttsEnabled = useModeStore((s) => s.ttsEnabled);
  const setTtsEnabled = useModeStore((s) => s.setTtsEnabled);
  const status = voice.status;
  const listening = status === 'listening' || status === 'requesting';

  return (
    <div className={`voice voice-${status}`}>
      <span className={`voice-status t-caption ${status === 'listening' ? 'is-on' : ''}`} aria-live="polite">
        <StatusDot />
        {STATUS_LABEL[status]}
        {voice.lastUtterance && status === 'listening' && <span className="voice-heard">“{voice.lastUtterance}”</span>}
      </span>

      {status === 'unsupported' && <span className="t-caption t-muted">이 브라우저에는 음성 인식이 없습니다. 화면과 키보드로 전환하세요.</span>}

      {status === 'denied' && (
        <span className="t-caption t-muted voice-help">
          브라우저가 마이크를 막고 있습니다. 주소창 자물쇠 → 마이크 허용 후 새로고침하세요.
        </span>
      )}

      {status === 'error' && (
        <>
          <span className="t-caption t-danger voice-help">{voice.error}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={controls.start}>
            다시 시도
          </button>
        </>
      )}

      {(status === 'off' || status === 'listening' || status === 'requesting') && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={listening ? controls.stop : controls.start}
          aria-pressed={listening}
          title={listening ? '음성 끄기' : '음성 켜기 (마이크 권한을 요청합니다)'}
        >
          {listening ? <IconMicOff /> : <IconMic />}
          {listening ? '음성 끄기' : '음성 켜기'}
        </button>
      )}

      {status !== 'unsupported' && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setTtsEnabled(!ttsEnabled)}
          aria-pressed={ttsEnabled}
          disabled={!voice.ttsAvailable}
          title={voice.ttsAvailable ? '전환 시 "○○ 모드" 안내음' : '한국어 음성이 없어 안내음을 낼 수 없습니다'}
        >
          안내음 {voice.ttsAvailable ? (ttsEnabled ? '켜짐' : '꺼짐') : '없음'}
        </button>
      )}
    </div>
  );
}

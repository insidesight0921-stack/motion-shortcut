import { useEffect, useRef, useState } from 'react';
import { comboFromTrustedEvent, formatKeyCombo } from '../commands/keyPress';

interface Props {
  value: string;
  onChange: (combo: string) => void;
  /** 캡처 시작/종료 알림. 매핑 실행 일시 중지에 쓴다 (보완 1) */
  onCapturingChange?: (capturing: boolean) => void;
  id?: string;
  'aria-describedby'?: string;
}

/**
 * "키를 누르세요" 캡처 방식 입력. 텍스트를 타이핑하지 않고 실제 키 입력을 받아 "Shift+ArrowRight" 형태로 저장한다.
 *  - isTrusted=false(합성) 이벤트는 무시한다: 우리 key.press 명령이 되먹임되지 않는다.
 *  - 캡처 중에는 onCapturingChange(true)로 매핑 실행을 멈춘다: 손을 든 채 키보드를 만지다 제스처가 실행되는 것을 막는다.
 *  - Escape 로 취소, 포커스를 잃으면 종료.
 */
export function KeyCaptureInput({ value, onChange, onCapturingChange, id, 'aria-describedby': describedBy }: Props) {
  const [capturing, setCapturing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const stop = () => setCapturing(false);

  useEffect(() => {
    onCapturingChange?.(capturing);
    if (!capturing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.isTrusted) return; // 합성 이벤트 무시
      if (e.key === 'Escape') {
        e.preventDefault();
        stop();
        return;
      }
      const combo = comboFromTrustedEvent(e);
      if (!combo) return; // 수식키만 눌린 상태
      e.preventDefault();
      e.stopPropagation();
      onChange(formatKeyCombo(combo));
      stop();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      onCapturingChange?.(false);
    };
    // onChange/onCapturingChange는 부모가 매 렌더 새로 만들 수 있어 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing]);

  return (
    <button
      ref={buttonRef}
      type="button"
      id={id}
      className={`input key-capture ${capturing ? 'is-capturing' : ''}`}
      onClick={() => setCapturing((c) => !c)}
      onBlur={stop}
      aria-describedby={describedBy}
      aria-live="polite"
      title={capturing ? '원하는 키 조합을 누르세요. Esc로 취소' : '클릭한 뒤 키를 눌러 바꿉니다'}
    >
      {capturing ? (
        <span className="t-subtle">키를 누르세요… (Esc 취소)</span>
      ) : (
        <>
          <kbd className="key-capture-value">{value || '없음'}</kbd>
          <span className="t-caption t-muted">클릭해서 바꾸기</span>
        </>
      )}
    </button>
  );
}

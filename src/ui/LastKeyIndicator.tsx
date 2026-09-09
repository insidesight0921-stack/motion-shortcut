import { useEffect, useState } from 'react';
import { comboFromKeyboardEvent, formatKeyCombo } from '../commands/keyPress';
import { useTargetStore } from '../store/targetStore';

/**
 * 이 페이지가 마지막으로 받은 키 입력. key.press 명령의 데모 대상이다.
 * 실제 입력(isTrusted=true)과 우리가 합성한 이벤트(false)를 구분해 보여 준다.
 */
export function LastKeyIndicator() {
  const lastKey = useTargetStore((s) => s.lastKey);
  const [, force] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const combo = comboFromKeyboardEvent(e);
      if (!combo) return;
      useTargetStore.getState().setLastKey({ combo, trusted: e.isTrusted, at: Date.now() });
    };
    // 합성 이벤트는 body에 dispatch되어 window까지 올라온다
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // "n초 전" 갱신
  useEffect(() => {
    if (!lastKey) return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [lastKey]);

  const ago = lastKey ? Math.max(0, Math.round((Date.now() - lastKey.at) / 1000)) : 0;

  return (
    <section className="card" aria-labelledby="lastkey-title">
      <div className="card-head">
        <h2 id="lastkey-title" className="t-title-3">
          마지막으로 받은 키
        </h2>
        <span className="t-caption t-muted">key.press 확인용</span>
      </div>
      {lastKey ? (
        <div className="last-key">
          <kbd className="last-key-combo t-title-2">{formatKeyCombo(lastKey.combo)}</kbd>
          <span className="t-caption t-subtle">
            {lastKey.trusted ? '실제 키보드 입력' : '합성 이벤트 (isTrusted=false)'} · {ago}초 전
          </span>
        </div>
      ) : (
        <p className="t-body-2 t-subtle">아직 받은 키가 없습니다. 키보드를 누르거나 키 입력 명령을 실행하면 여기에 표시됩니다.</p>
      )}
      <p className="t-caption t-muted last-key-help reading">
        합성 이벤트는 이 페이지 안의 리스너에만 전달됩니다. YouTube 플레이어나 브라우저 기본 동작(스크롤 등)은 반응하지 않습니다.
      </p>
    </section>
  );
}

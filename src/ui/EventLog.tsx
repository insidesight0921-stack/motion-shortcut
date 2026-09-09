import { useState } from 'react';
import { formatLog, formatTime, RESULT_KO, useLogStore } from '../store/logStore';
import { GESTURE_LABEL } from './Hud';

/** 실행 로그 카드. 실행 / 실행 실패 / 무시를 구분하고 무시·실패 사유를 함께 남긴다. "복사"로 전체를 텍스트로 가져갈 수 있다. */
export function EventLog() {
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatLog([...entries].reverse()));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      alert('브라우저가 클립보드 쓰기를 막았습니다. 개발자 도구 콘솔의 [motion] 줄을 대신 복사하세요.');
    }
  };

  return (
    <section className="card" aria-labelledby="log-title">
      <div className="card-head">
        <div>
          <h2 id="log-title" className="t-title-3">
            실행 로그
          </h2>
          <p className="t-caption t-muted">최근 200건 · 콘솔에도 같은 줄이 남습니다</p>
        </div>
        <div className="log-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy} disabled={entries.length === 0}>
            {copied ? '복사됨' : '복사'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={entries.length === 0}>
            지우기
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="log-empty t-body-2">아직 기록이 없습니다. 카메라를 시작하고 제스처를 취하면 여기에 쌓입니다.</p>
      ) : (
        <div className="log-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>시각</th>
                <th>제스처 / 주체</th>
                <th>명령</th>
                <th>결과</th>
                <th>사유 / 비고</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={`log-row-${e.result}`}>
                  <td data-label="시각" className="mono">
                    {formatTime(e.time)}
                  </td>
                  <td data-label="제스처">{e.gesture ? GESTURE_LABEL[e.gesture] : (e.subject ?? '–')}</td>
                  <td data-label="명령">{e.command ?? '–'}</td>
                  <td data-label="결과" className={e.result === 'failed' ? 't-danger' : ''}>
                    {RESULT_KO[e.result]}
                  </td>
                  <td data-label="사유">{[e.reason, e.note].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

import { useState } from 'react';
import { formatLog, formatTime, useLogStore } from '../store/logStore';
import { GESTURE_LABEL } from './Hud';

/** 실행 로그. 무시된 후보도 사유와 함께. "복사"로 전체를 텍스트로 가져갈 수 있다. */
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
      // 클립보드 권한이 없으면 콘솔에 남긴 로그를 쓰라고 안내
      alert('클립보드에 쓸 수 없습니다. 브라우저 콘솔의 [motion] 로그를 복사하세요.');
    }
  };

  return (
    <div className="log">
      <div className="log-head">
        <h3>실행 로그</h3>
        <span className="log-count">{entries.length}건 (최근 200건, 콘솔에도 동일 기록)</span>
        <div className="log-actions">
          <button type="button" onClick={copy} disabled={entries.length === 0}>
            {copied ? '복사됨' : '복사'}
          </button>
          <button type="button" onClick={clear} disabled={entries.length === 0}>
            지우기
          </button>
        </div>
      </div>
      <div className="log-table-wrap">
        <table className="log-table">
          <thead>
            <tr>
              <th>시각</th>
              <th>제스처</th>
              <th>명령</th>
              <th>결과</th>
              <th>사유 / 비고</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="log-empty">
                  아직 기록이 없습니다. 카메라를 시작하고 제스처를 취해 보세요.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className={`log-${e.result}`}>
                <td className="mono">{formatTime(e.time)}</td>
                <td>{GESTURE_LABEL[e.gesture]}</td>
                <td>{e.command ?? '-'}</td>
                <td>{e.result === 'executed' ? '실행' : e.result === 'noop' ? '변화 없음' : '무시'}</td>
                <td>{[e.reason, e.note].filter(Boolean).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

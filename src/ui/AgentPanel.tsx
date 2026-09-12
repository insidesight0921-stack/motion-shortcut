import { useAgentStore } from '../store/agentStore';
import { StatusDot } from './icons';
import type { AgentControls } from './useAgent';

const STATUS_LABEL = {
  disconnected: '에이전트 없음 · 페이지 안 폴백',
  connecting: '에이전트 연결 중',
  hello_wait: '에이전트 응답 대기',
  ready: '에이전트 연결됨',
  error: '에이전트 오류',
} as const;

interface Props {
  controls: AgentControls;
}

/**
 * 로컬 에이전트 연결 상태 카드. 에이전트가 없으면 페이지 안 폴백으로 동작하지만
 * 폴백은 발표 프로그램에 닿지 않는다는 사실을 항상 보여 준다 (D-017).
 */
export function AgentPanel({ controls }: Props) {
  const a = useAgentStore();
  const ready = a.status === 'ready';

  return (
    <section className="card" aria-labelledby="agent-title">
      <div className="card-head">
        <h2 id="agent-title" className="t-title-3">
          로컬 에이전트
        </h2>
        <span className={`agent-status t-caption ${ready ? 'is-on' : ''}`}>
          <StatusDot />
          {STATUS_LABEL[a.status]}
        </span>
      </div>

      <dl className="agent-facts t-caption">
        <dt>주소</dt>
        <dd className="mono">{a.url || '–'}</dd>
        <dt>플랫폼</dt>
        <dd>{a.platform ?? '–'}</dd>
        <dt>기능</dt>
        <dd>{a.capabilities.length ? a.capabilities.join(' · ') : '–'}</dd>
        <dt>손쉬운 사용</dt>
        <dd>{a.permissions ? (a.permissions.accessibility ? '허용' : '없음 — 시스템 설정 › 개인정보 보호 및 보안 › 손쉬운 사용') : '–'}</dd>
      </dl>

      {a.panicAt && <p className="t-caption t-danger">에이전트에서 긴급 정지가 눌렸습니다. MOTION OFF 상태입니다. 에이전트 패널에서 해제하면 다시 켤 수 있습니다.</p>}
      {a.lastError && <p className="t-caption t-danger">마지막 오류: {a.lastError}</p>}
      {a.detail && !ready && <p className="t-caption t-muted">{a.detail}</p>}

      {!ready && (
        <p className="t-caption t-subtle reading">
          에이전트가 없을 때 명령은 이 페이지 안에서만 실행되는 합성 키 이벤트로 나갑니다. 발표 프로그램을 실제로 제어하려면 에이전트가 필요합니다. 개발 중에는 <code>pnpm mock-agent</code>로 모의 에이전트를 띄울 수 있습니다.
        </p>
      )}

      <div className="agent-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={controls.retry} disabled={ready}>
          다시 연결
        </button>
      </div>
    </section>
  );
}

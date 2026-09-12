import { useState } from 'react';
import { PROGRAM_LABEL, PROGRAMS, type Program } from '../profile/types';
import { useAgentStore } from '../store/agentStore';
import { useGestureStore } from '../store/gestureStore';
import { useProfileStore } from '../store/profileStore';
import { useUiStore } from '../store/uiStore';
import { StatusDot } from './icons';

/** 홈 (§21): 최근 프로필, 새 발표 만들기, 빠른 발표 시작, 카메라·에이전트 상태 */
export function Home() {
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeProfileId);
  const setActive = useProfileStore((s) => s.setActive);
  const create = useProfileStore((s) => s.create);
  const migrated = useProfileStore((s) => s.migratedFromLegacy);
  const dismiss = useProfileStore((s) => s.dismissMigrationNotice);
  const setView = useUiStore((s) => s.setView);
  const cameraRunning = useGestureStore((s) => s.visionStatus === 'running');
  const agentStatus = useAgentStore((s) => s.status);
  const accessibility = useAgentStore((s) => s.permissions?.accessibility ?? null);

  const [name, setName] = useState('');
  const [program, setProgram] = useState<Program>('powerpoint');
  const [creating, setCreating] = useState(false);

  const recent = [...profiles].sort((a, b) => b.updatedAt - a.updatedAt);

  const submit = () => {
    if (!name.trim()) return;
    create(name, program);
    setName('');
    setCreating(false);
    setView('profile');
  };

  return (
    <>
      {migrated && (
        <section className="card notice" role="status">
          <p className="t-body-2">이전에 저장해 둔 제스처 매핑을 "기본 프로필"의 슬라이드 모드로 옮겼습니다. 제스처 설정에서 확인하세요.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
            확인
          </button>
        </section>
      )}

      <section className="card" aria-labelledby="home-status-title">
        <div className="card-head">
          <h2 id="home-status-title" className="t-title-3">
            상태
          </h2>
        </div>
        <ul className="status-list t-body-2">
          <li>
            <span className={`status-item ${cameraRunning ? 'is-on' : ''}`}>
              <StatusDot />
              카메라 {cameraRunning ? '켜짐' : '꺼짐'}
            </span>
            <span className="t-caption t-muted">왼쪽 카드에서 켜고 끕니다. 영상은 이 기기 밖으로 나가지 않습니다.</span>
          </li>
          <li>
            <span className={`status-item ${agentStatus === 'ready' ? 'is-on' : ''}`}>
              <StatusDot />
              로컬 에이전트 {agentStatus === 'ready' ? '연결됨' : '없음 · 페이지 안 폴백'}
            </span>
            <span className="t-caption t-muted">{accessibility === false ? '손쉬운 사용 권한이 없어 키·커서를 보낼 수 없습니다.' : '발표 프로그램 제어는 에이전트가 수행합니다.'}</span>
          </li>
        </ul>
      </section>

      <section className="card" aria-labelledby="home-profiles-title">
        <div className="card-head">
          <h2 id="home-profiles-title" className="t-title-3">
            발표 프로필
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
            {creating ? '취소' : '새 발표 만들기'}
          </button>
        </div>

        {creating && (
          <form
            className="profile-create"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="field">
              <label htmlFor="new-profile-name" className="field-label">
                발표 이름
              </label>
              <input id="new-profile-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 9월 제품 소개" autoFocus />
              <p className="field-error" />
            </div>
            <div className="field">
              <label htmlFor="new-profile-program" className="field-label">
                발표 프로그램
              </label>
              <span className="select-wrap">
                <select id="new-profile-program" className="input select" value={program} onChange={(e) => setProgram(e.target.value as Program)}>
                  {PROGRAMS.map((p) => (
                    <option key={p} value={p}>
                      {PROGRAM_LABEL[p]}
                    </option>
                  ))}
                </select>
              </span>
              <p className="field-error" />
            </div>
            <button type="submit" className="btn btn-secondary" disabled={!name.trim()}>
              만들기
            </button>
          </form>
        )}

        <ul className="profile-list">
          {recent.map((p) => {
            const active = p.id === activeId;
            return (
              <li key={p.id} className={`profile-row ${active ? 'is-active' : ''}`}>
                <button type="button" className="profile-row-main" onClick={() => setActive(p.id)} aria-pressed={active}>
                  <span className="t-body-1 t-strong">{p.name}</span>
                  <span className="t-caption t-subtle">
                    {PROGRAM_LABEL[p.program]} · {p.rehearsal ? '리허설 완료' : '리허설 전'} · {new Date(p.updatedAt).toLocaleDateString('ko-KR')}
                  </span>
                </button>
                {active && (
                  <div className="profile-row-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('profile')}>
                      설정
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('gestures')}>
                      제스처
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('standby')}>
                      발표 준비
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

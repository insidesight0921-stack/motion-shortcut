import { useId, useState } from 'react';
import { AGENT_PORT_DEFAULT, PROGRAM_LABEL, PROGRAMS, type Program } from '../profile/types';
import { useProfileStore } from '../store/profileStore';
import { useUiStore } from '../store/uiStore';
import type { VoiceControls } from './useVoice';
import { VoiceIndicator } from './VoiceIndicator';

interface Props {
  voice: VoiceControls;
}

/** 발표 프로필 설정 (§21). 음성 전환은 실험 기능으로 맨 아래에만 둔다 (D-017) */
export function ProfileSettings({ voice }: Props) {
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0]);
  const rename = useProfileStore((s) => s.rename);
  const setProgram = useProfileStore((s) => s.setProgram);
  const updateSettings = useProfileStore((s) => s.updateSettings);
  const remove = useProfileStore((s) => s.remove);
  const count = useProfileStore((s) => s.profiles.length);
  const setView = useUiStore((s) => s.setView);
  const id = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const s = profile.settings;

  return (
    <>
      <section className="card" aria-labelledby="ps-title">
        <div className="card-head">
          <h2 id="ps-title" className="t-title-3">
            프로필 설정
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('gestures')}>
            제스처 설정으로
          </button>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${id}-name`} className="field-label">
              발표 이름
            </label>
            <input id={`${id}-name`} className="input" defaultValue={profile.name} key={profile.id} onBlur={(e) => rename(profile.id, e.target.value)} />
            <p className="field-error" />
          </div>
          <div className="field">
            <label htmlFor={`${id}-program`} className="field-label">
              발표 프로그램
            </label>
            <span className="select-wrap">
              <select id={`${id}-program`} className="input select" value={profile.program} onChange={(e) => setProgram(profile.id, e.target.value as Program)}>
                {PROGRAMS.map((p) => (
                  <option key={p} value={p}>
                    {PROGRAM_LABEL[p]}
                  </option>
                ))}
              </select>
            </span>
            <p className="field-error">{profile.program === 'keynote' ? 'Keynote 는 macOS 에서만 동작합니다.' : ''}</p>
          </div>
          <div className="field">
            <label htmlFor={`${id}-toggle`} className="field-label">
              모션 켜기/끄기 제스처
            </label>
            <span className="select-wrap">
              <select id={`${id}-toggle`} className="input select" value={s.motionToggle} onChange={(e) => updateSettings({ motionToggle: e.target.value as 'x_cross' | 'fist' })}>
                <option value="x_cross">양손으로 X 만들어 1초 유지 (권장)</option>
                <option value="fist">주먹 1.2초 유지 (한 손)</option>
              </select>
            </span>
            <p className="field-error" />
            <p className="t-caption t-muted">MOTION OFF 에서는 어떤 한 손 제스처도 실행되지 않습니다. 화면 버튼과 Ctrl+Shift+0 은 항상 됩니다.</p>
          </div>
          <div className="field">
            <label htmlFor={`${id}-hand`} className="field-label">
              커서·레이저를 움직이는 손
            </label>
            <span className="select-wrap">
              <select id={`${id}-hand`} className="input select" value={s.activeHand} onChange={(e) => updateSettings({ activeHand: e.target.value as 'left' | 'right' })}>
                <option value="right">오른손</option>
                <option value="left">왼손</option>
              </select>
            </span>
            <p className="field-error" />
          </div>
          <div className="field">
            <label htmlFor={`${id}-port`} className="field-label">
              로컬 에이전트 포트
            </label>
            <input
              id={`${id}-port`}
              className="input num"
              type="number"
              min={1024}
              max={65535}
              defaultValue={s.agentPort}
              key={`${profile.id}-port`}
              onBlur={(e) => updateSettings({ agentPort: Math.round(Number(e.target.value) || AGENT_PORT_DEFAULT) })}
            />
            <p className="field-error" />
            <p className="t-caption t-muted">기본 {AGENT_PORT_DEFAULT}. 에이전트와 같은 값이어야 합니다.</p>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="ps-assets-title">
        <div className="card-head">
          <h2 id="ps-assets-title" className="t-title-3">
            발표 자료 등록
          </h2>
        </div>
        <p className="t-body-2 t-subtle reading">링크·파일·앱을 슬롯에 등록하고 제스처로 여는 기능은 3차에서 추가됩니다. 등록된 자료만 실행되며 에이전트가 목록을 다시 확인합니다.</p>
      </section>

      <section className="card" aria-labelledby="ps-exp-title">
        <div className="card-head">
          <h2 id="ps-exp-title" className="t-title-3">
            실험 기능
          </h2>
        </div>
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={s.voiceEnabled} onChange={(e) => updateSettings({ voiceEnabled: e.target.checked })} />
            <span className="t-body-2">음성으로 모드 전환 ("슬라이드 모드", "레이저 모드", "대기", "깨어나")</span>
          </label>
          <p className="t-caption t-muted reading">인식은 Google 음성 서버를 거치며 오프라인에서는 동작하지 않습니다. 명령 실행에는 쓰지 않습니다. 기본은 꺼짐입니다.</p>
        </div>
        {s.voiceEnabled && <VoiceIndicator controls={voice} />}
      </section>

      <section className="card" aria-labelledby="ps-danger-title">
        <div className="card-head">
          <h2 id="ps-danger-title" className="t-title-3">
            프로필 삭제
          </h2>
        </div>
        <p className="t-caption t-subtle reading">이 프로필의 매핑, 자료 슬롯, 리허설 통계가 함께 삭제됩니다. 되돌릴 수 없습니다.</p>
        {confirmDelete ? (
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                remove(profile.id);
                setConfirmDelete(false);
                setView('home');
              }}
            >
              "{profile.name}" 삭제
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)} disabled={count === 0}>
            삭제…
          </button>
        )}
      </section>
    </>
  );
}

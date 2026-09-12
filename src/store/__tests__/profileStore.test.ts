import { beforeEach, describe, expect, it } from 'vitest';
import { emptyMapping } from '../../mapping/defaults';
import { LOCKED_ENTRY } from '../../mapping/types';
import { createProfile, defaultSlideMapping } from '../../profile/defaults';
import { useProfileStore } from '../profileStore';

beforeEach(() => {
  const p = createProfile('기본 프로필', 'powerpoint', 1);
  useProfileStore.setState({ profiles: [p], activeProfileId: p.id, migratedFromLegacy: false });
});

describe('profileStore', () => {
  it('생성하면 활성 프로필이 되고, 삭제하면 다른 프로필로 넘어간다', () => {
    const s = useProfileStore.getState();
    const first = s.active();
    const b = s.create('발표 B', 'keynote');
    expect(useProfileStore.getState().activeProfileId).toBe(b.id);
    expect(useProfileStore.getState().active().program).toBe('keynote');
    useProfileStore.getState().remove(b.id);
    expect(useProfileStore.getState().activeProfileId).toBe(first.id);
  });

  it('마지막 프로필을 지우면 새 기본 프로필이 만들어진다', () => {
    const id = useProfileStore.getState().activeProfileId;
    useProfileStore.getState().remove(id);
    const st = useProfileStore.getState();
    expect(st.profiles).toHaveLength(1);
    expect(st.profiles[0].id).not.toBe(id);
  });

  it('프로필 삭제 시 리허설 통계와 자료 슬롯도 함께 사라진다 (§18)', () => {
    const s = useProfileStore.getState();
    const p = s.create('리허설 있음', 'powerpoint');
    useProfileStore.setState({
      profiles: useProfileStore.getState().profiles.map((x) =>
        x.id === p.id
          ? { ...x, rehearsal: { version: 1, recordedAt: 1, durationMs: 60_000, summary: { palmRate: 0.4 } }, assets: [{ id: 'a1', kind: 'url', value: 'https://example.com', label: '예시', gesture: null }] }
          : x,
      ),
    });
    useProfileStore.getState().remove(p.id);
    const all = useProfileStore.getState().profiles;
    expect(all.some((x) => x.id === p.id)).toBe(false);
    expect(all.some((x) => x.rehearsal || x.assets.length)).toBe(false);
  });

  it('매핑 편집은 활성 프로필의 해당 모드만 바꾸고 주먹은 막는다', () => {
    const s = useProfileStore.getState();
    s.setCommand('slide', 'open_palm', 'none');
    s.setEntry('slide', 'fist', { commandId: 'key.press', params: { combo: 'Space' } });
    const m = useProfileStore.getState().mapping('slide');
    expect(m.open_palm.commandId).toBe('none');
    expect(m.fist).toEqual(LOCKED_ENTRY);
    expect(useProfileStore.getState().mapping('cursor')).toEqual(emptyMapping());
  });

  it('setCommand 는 기본 파라미터를 채우고, resetMapping 은 모드 기본값으로 되돌린다', () => {
    const s = useProfileStore.getState();
    s.setCommand('slide', 'circle', 'key.press');
    expect(useProfileStore.getState().mapping('slide').circle).toEqual({ commandId: 'key.press', params: { combo: 'ArrowRight' } });
    s.setParams('slide', 'circle', { combo: 'Shift+K' });
    expect(useProfileStore.getState().mapping('slide').circle.params).toEqual({ combo: 'Shift+K' });
    s.resetMapping('slide');
    expect(useProfileStore.getState().mapping('slide')).toEqual(defaultSlideMapping('powerpoint'));
  });

  it('system.toggleEnabled 는 다른 제스처에 붙일 수 없다', () => {
    useProfileStore.getState().setCommand('slide', 'open_palm', 'system.toggleEnabled');
    expect(useProfileStore.getState().mapping('slide').open_palm.commandId).not.toBe('system.toggleEnabled');
  });

  it('설정 변경은 활성 프로필에만 반영된다', () => {
    const s = useProfileStore.getState();
    const a = s.active();
    const b = s.create('B', 'keynote');
    useProfileStore.getState().updateSettings({ motionToggle: 'fist', agentPort: 5000 });
    const st = useProfileStore.getState();
    expect(st.profiles.find((p) => p.id === b.id)!.settings.motionToggle).toBe('fist');
    expect(st.profiles.find((p) => p.id === a.id)!.settings.motionToggle).toBe('x_cross');
  });
});

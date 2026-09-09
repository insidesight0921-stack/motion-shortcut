import { DEFAULT_MAPPING, emptyMapping } from '../mapping/defaults';
import { MODE_ORDER, type ModeDef, type ModeId, type UserModeId } from './types';

const EMPTY_DESCRIPTION = '이 모드의 대상은 다음 단계에서 추가됩니다. 매핑은 지금도 연결할 수 있습니다.';

/**
 * 모드 카탈로그. media 만 실제 동작하고 reading/presentation/meeting 은 빈 프리셋(전부 none, 주먹 고정)이다.
 * voiceAliases: "모드"가 붙은 형태는 포함 매칭, 단독 단어는 완전 일치 (keywords.ts, 보완 1).
 */
export const MODES: Record<ModeId, ModeDef> = {
  media: {
    id: 'media',
    name: '미디어',
    description: 'YouTube 플레이어·타이머·키 입력 확인 대상이 있는 모드.',
    voiceAliases: ['미디어 모드', '영상 모드', '미디어', '영상'],
    shortcutDigit: '1',
    defaultMapping: DEFAULT_MAPPING,
    targets: ['youtube', 'timer', 'lastKey'],
    customGestures: [],
  },
  reading: {
    id: 'reading',
    name: '읽기',
    description: EMPTY_DESCRIPTION,
    voiceAliases: ['읽기 모드', '문서 모드', '읽기', '문서'],
    shortcutDigit: '2',
    defaultMapping: emptyMapping(),
    targets: [],
    customGestures: [],
  },
  presentation: {
    id: 'presentation',
    name: '발표',
    description: EMPTY_DESCRIPTION,
    voiceAliases: ['발표 모드', '프레젠테이션 모드', '프레젠테이션', '발표'],
    shortcutDigit: '3',
    defaultMapping: emptyMapping(),
    targets: [],
    customGestures: [],
  },
  meeting: {
    id: 'meeting',
    name: '회의',
    description: EMPTY_DESCRIPTION,
    voiceAliases: ['회의 모드', '미팅 모드', '회의', '미팅'],
    shortcutDigit: '4',
    defaultMapping: emptyMapping(),
    targets: [],
    customGestures: [],
  },
  standby: {
    id: 'standby',
    name: '대기',
    description: '카메라는 켜져 있지만 아무 명령도 실행하지 않습니다. 주먹으로도 풀리지 않으며 음성·키보드·화면으로만 해제합니다.',
    voiceAliases: [], // 대기 진입/해제 별칭은 keywords.ts 의 STANDBY_ALIASES / WAKE_ALIASES
    shortcutDigit: '0',
    defaultMapping: null,
    targets: [],
    customGestures: [],
  },
};

export const USER_MODES: ModeDef[] = MODE_ORDER.map((id) => MODES[id]);

export function isModeId(id: unknown): id is ModeId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(MODES, id);
}

export function isUserModeId(id: unknown): id is UserModeId {
  return isModeId(id) && id !== 'standby';
}

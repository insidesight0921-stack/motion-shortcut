import { emptyMapping } from '../mapping/defaults';
import { defaultSlideMapping } from '../profile/defaults';
import { MODE_ORDER, type ModeDef, type ModeId, type UserModeId } from './types';

/**
 * 모드 카탈로그 (D-017). 실제 매핑은 프로필이 갖고, 여기 defaultMapping 은 "기본값으로 되돌리기"의 원본이다.
 * voiceAliases: "모드"가 붙은 형태는 포함 매칭, 단독 단어는 완전 일치 (keywords.ts).
 */
export const MODES: Record<ModeId, ModeDef> = {
  slide: {
    id: 'slide',
    name: '슬라이드',
    labelEn: 'SLIDE MODE',
    description: '발표 기본 모드. 다음·이전·첫 슬라이드, 발표 시작, 화면 가리기, 발표 화면 복귀.',
    voiceAliases: ['슬라이드 모드', '발표 모드', '슬라이드'],
    shortcutDigit: '1',
    entryDirection: 'down',
    continuousControl: null,
    defaultMapping: defaultSlideMapping('powerpoint'),
    customGestures: [],
  },
  cursor: {
    id: 'cursor',
    name: '커서',
    labelEn: 'CURSOR MODE',
    description: '오른손으로 시스템 커서를 움직이고 왼손 펼치기→주먹으로 클릭합니다. 이 모드에서는 슬라이드 제스처가 꺼집니다.',
    voiceAliases: ['커서 모드', '마우스 모드', '커서'],
    shortcutDigit: '2',
    entryDirection: 'left',
    continuousControl: 'cursor',
    defaultMapping: emptyMapping(),
    customGestures: [],
  },
  laser: {
    id: 'laser',
    name: '레이저',
    labelEn: 'LASER MODE',
    description: '오른손 위치에 레이저 포인터를 표시합니다. 시스템 커서는 움직이지 않습니다.',
    voiceAliases: ['레이저 모드', '포인터 모드', '레이저'],
    shortcutDigit: '3',
    entryDirection: 'right',
    continuousControl: 'laser',
    defaultMapping: emptyMapping(),
    customGestures: [],
  },
  asset: {
    id: 'asset',
    name: '자료',
    labelEn: 'ASSET MODE',
    description: '프로필에 등록한 링크·파일·앱을 제스처로 엽니다. 등록된 자료만 실행됩니다.',
    voiceAliases: ['자료 모드', '자료'],
    shortcutDigit: '4',
    entryDirection: 'up',
    continuousControl: null,
    defaultMapping: emptyMapping(),
    customGestures: [],
  },
  standby: {
    id: 'standby',
    name: '모션 꺼짐',
    labelEn: 'MOTION OFF',
    description: '카메라는 켜져 있지만 아무 명령도 실행하지 않습니다. 양손 X 유지, 화면, 키보드로 켭니다. 한 손 제스처로는 켜지지 않습니다.',
    voiceAliases: [],
    shortcutDigit: '0',
    entryDirection: null,
    continuousControl: null,
    defaultMapping: null,
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

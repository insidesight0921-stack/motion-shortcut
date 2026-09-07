import type { Mode } from '../../commands/types';
import { cookingCommands } from './commands';

/**
 * 요리 모드 제스처 ↔ 명령 매핑 (기획서 표 그대로).
 * fist는 활성화 토글이라 모드 매핑에 없다 (엔진이 직접 처리).
 * 방향 기준: 사용자 시점. swipe_right = 사용자의 오른쪽으로 손을 옮김 = 다음 단계.
 */
export const cookingMode: Mode = {
  id: 'cooking',
  name: '요리 모드',
  mapping: {
    open_palm: 'video.toggle',
    swipe_right: 'recipe.next',
    swipe_left: 'recipe.prev',
    circle: 'timer.toggle',
  },
  commands: cookingCommands,
};

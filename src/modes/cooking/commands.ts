import type { Command, CommandId } from '../../commands/types';
import { useCookingStore } from '../../store/cookingStore';

/** 요리 모드 명령 4개. 스토어를 직접 조작한다. */
export const cookingCommands: Record<CommandId, Command> = {
  'video.toggle': {
    id: 'video.toggle',
    label: '영상 재생/일시정지',
    run: () => {
      const { playerApi, playerReady } = useCookingStore.getState();
      if (!playerApi || !playerReady) return { ok: false, message: '플레이어가 아직 준비되지 않음' };
      const state = playerApi.getState();
      if (state === 'playing' || state === 'buffering') {
        playerApi.pause();
        return { ok: true, message: '일시정지' };
      }
      playerApi.play();
      return { ok: true, message: '재생' };
    },
  },
  'recipe.next': {
    id: 'recipe.next',
    label: '다음 조리 단계',
    run: () => {
      const moved = useCookingStore.getState().nextStep();
      const { stepIndex, recipe } = useCookingStore.getState();
      return moved
        ? { ok: true, message: `${stepIndex + 1}/${recipe.steps.length}단계: ${recipe.steps[stepIndex].title}` }
        : { ok: false, message: '이미 마지막 단계' };
    },
  },
  'recipe.prev': {
    id: 'recipe.prev',
    label: '이전 조리 단계',
    run: () => {
      const moved = useCookingStore.getState().prevStep();
      const { stepIndex, recipe } = useCookingStore.getState();
      return moved
        ? { ok: true, message: `${stepIndex + 1}/${recipe.steps.length}단계: ${recipe.steps[stepIndex].title}` }
        : { ok: false, message: '이미 첫 단계' };
    },
  },
  'timer.toggle': {
    id: 'timer.toggle',
    label: '3분 타이머 시작/정지',
    run: ({ now }) => {
      const what = useCookingStore.getState().toggleTimer(now);
      return { ok: true, message: what === 'started' ? '3분 타이머 시작' : '타이머 정지' };
    },
  },
};

import { RecipeSteps } from './RecipeSteps';
import { Timer } from './Timer';
import { YouTubePlayer } from './YouTubePlayer';

interface Props {
  onTimerDone?: () => void;
}

/** 요리 모드: 레시피 / 영상 / 타이머 세 장의 형제 카드 (카드 안에 카드 없음, §4) */
export function CookingMode({ onTimerDone }: Props) {
  return (
    <>
      <RecipeSteps />
      <YouTubePlayer />
      <Timer onDone={onTimerDone} />
    </>
  );
}

import { RecipeSteps } from './RecipeSteps';
import { Timer } from './Timer';
import { YouTubePlayer } from './YouTubePlayer';

interface Props {
  onTimerDone?: () => void;
}

export function CookingMode({ onTimerDone }: Props) {
  return (
    <div className="cooking">
      <RecipeSteps />
      <YouTubePlayer />
      <Timer onDone={onTimerDone} />
    </div>
  );
}

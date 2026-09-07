import { useCookingStore } from '../../store/cookingStore';

/** 레시피 단계 카드. 현재 단계를 크게, 나머지는 목록으로. 마우스 폴백 버튼 포함. */
export function RecipeSteps() {
  const recipe = useCookingStore((s) => s.recipe);
  const stepIndex = useCookingStore((s) => s.stepIndex);
  const nextStep = useCookingStore((s) => s.nextStep);
  const prevStep = useCookingStore((s) => s.prevStep);
  const goToStep = useCookingStore((s) => s.goToStep);
  const current = recipe.steps[stepIndex];
  const total = recipe.steps.length;

  return (
    <div className="recipe">
      <div className="recipe-head">
        <h2 className="recipe-title">{recipe.title}</h2>
        <span className="recipe-progress">
          {stepIndex + 1} / {total}
        </span>
      </div>

      <div className="recipe-current" key={stepIndex}>
        <div className="recipe-current-label">
          {stepIndex + 1}단계{current.time ? ` · 약 ${current.time}` : ''}
        </div>
        <div className="recipe-current-title">{current.title}</div>
        <p className="recipe-current-detail">{current.detail}</p>
      </div>

      <div className="recipe-nav">
        <button type="button" onClick={() => prevStep()} disabled={stepIndex === 0}>
          ← 이전 (왼쪽 스와이프)
        </button>
        <button type="button" onClick={() => nextStep()} disabled={stepIndex === total - 1}>
          다음 (오른쪽 스와이프) →
        </button>
      </div>

      <ol className="recipe-list">
        {recipe.steps.map((s, i) => (
          <li key={i} className={i === stepIndex ? 'is-current' : i < stepIndex ? 'is-done' : ''}>
            <button type="button" onClick={() => goToStep(i)}>
              {s.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

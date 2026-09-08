import { useCookingStore } from '../../store/cookingStore';

/** 레시피 카드. 현재 단계를 크게, 나머지는 목록으로. 마우스 폴백 버튼 포함. */
export function RecipeSteps() {
  const recipe = useCookingStore((s) => s.recipe);
  const stepIndex = useCookingStore((s) => s.stepIndex);
  const nextStep = useCookingStore((s) => s.nextStep);
  const prevStep = useCookingStore((s) => s.prevStep);
  const goToStep = useCookingStore((s) => s.goToStep);
  const current = recipe.steps[stepIndex];
  const total = recipe.steps.length;

  return (
    <section className="card" aria-labelledby="recipe-title">
      <div className="card-head">
        <h2 id="recipe-title" className="t-title-3">
          {recipe.title}
        </h2>
        <span className="t-caption t-muted num">
          {stepIndex + 1} / {total}단계
        </span>
      </div>

      <div className="recipe-current" key={stepIndex} aria-live="polite">
        <p className="recipe-current-label t-caption">
          {stepIndex + 1}단계{current.time ? ` · 약 ${current.time}` : ''}
        </p>
        <h3 className="recipe-current-title t-title-2">{current.title}</h3>
        <p className="t-body-2 reading">{current.detail}</p>
      </div>

      <div className="recipe-nav">
        <button type="button" className="btn btn-secondary" onClick={() => prevStep()} disabled={stepIndex === 0}>
          이전 단계
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => nextStep()} disabled={stepIndex === total - 1}>
          다음 단계
        </button>
      </div>
      <p className="recipe-hint t-caption">스와이프로도 이동합니다. 왼쪽은 이전, 오른쪽은 다음.</p>

      <ol className="recipe-list">
        {recipe.steps.map((s, i) => (
          <li key={i} className={i === stepIndex ? 'is-current' : i < stepIndex ? 'is-done' : ''}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => goToStep(i)} aria-current={i === stepIndex ? 'step' : undefined}>
              {i + 1}. {s.title}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

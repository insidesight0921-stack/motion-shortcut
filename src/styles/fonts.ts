/**
 * Pretendard Variable (dynamic subset) — docs/DESIGN.md §3.1.
 * 버전은 상수로 고정한다. 폰트가 못 오면 tokens.css의 --font-sans 폴백 스택이 쓰인다.
 */
export const PRETENDARD_VERSION = 'v1.3.9';

export const PRETENDARD_CSS_URL = `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@${PRETENDARD_VERSION}/dist/web/variable/pretendardvariable-dynamic-subset.min.css`;

export function loadPretendard(): void {
  if (document.querySelector(`link[href="${PRETENDARD_CSS_URL}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = PRETENDARD_CSS_URL;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

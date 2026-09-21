# Decisions

## 2026-09-21 — 손은 SVG 밖 HTML 오버레이로 배치 — foreignObject 미사용

- **배경:** Safari에서 튜토리얼 손이 계속 어긋나고 슬라이드 1은 애니메이션이 멈췄다. WebKit의 `<foreignObject>`는 조상 transform뿐 아니라 viewBox 변환도 제대로 따르지 않고, 내용이 바뀌어도 재그리기를 누락한다.
- **결정:** `<foreignObject>`를 완전히 제거한다. `TutorialMotion`의 `<svg>`에는 Laptop·path·text만 남기고, 모든 손은 svg 위에 겹친 `<div class="tutorial-hands">` 안의 HTML `<canvas class="tutorial-hand">`로 그린다.
  - `.tutorial-motion`은 `aspect-ratio: 800 / 310`을 항상 유지해 svg에 레터박스가 생기지 않게 한다(`width: min(100%, 880px, 98vh)` — 98vh = 기존 높이 제한 38vh × 800/310). 그래야 오버레이의 퍼센트 좌표가 svg 사용자 좌표와 1:1로 대응한다.
  - 손 위치·크기는 viewBox 단위(`x/y/scale`)를 퍼센트로 환산한다: `left = x/800`, `top = y/310`, `width = 220·scale/800`, `aspect-ratio: 220/250`. 기준점 (110,140)은 `translate(-50%, -56%)` + `transform-origin: 50% 56%`로 맞추고, 회전·좌우 반전은 같은 CSS `transform`에서 처리한다.
  - 좌표계 상수는 `src/components/tutorialViewBox.ts`의 `VIEWBOX`를 svg `viewBox`와 손이 공유한다.
  - 페이드는 `<g opacity>` 대신 `ArticulatedHand`의 `opacity` prop으로 처리한다.
- **제약:**
  - `<Hand>`(`ArticulatedHand`)는 `<svg>` 안에 두지 않고 `.tutorial-hands` 안에만 둔다.
  - svg 쪽 그룹에 transform이 있으면(슬라이드 3의 `translate(-110 0) scale(.85)`) 대응하는 손은 호출부에서 `x/y/scale`에 계산식으로 직접 반영하고 의도를 주석으로 남긴다.
  - `.tutorial-motion`의 비율과 `VIEWBOX`는 항상 같이 바꾼다.
  - 손은 항상 svg 위에 그려진다(svg 요소로 손을 덮을 수 없다).

## 2026-09-21 — (폐기) foreignObject는 조상 g transform 대신 자체 x/y/width/height 사용 — Safari 호환

- **상태:** WebKit에서 viewBox 변환까지는 해결하지 못해 폐기. 위 "HTML 오버레이" 결정으로 대체.
- **당시 배경:** WebKit은 `<foreignObject>`의 조상 `<g transform>`을 무시한다(WebKit bug 23113). Safari에서 튜토리얼 손이 전부 (0,0)에 겹쳐 그려졌다.
- **당시 결정:** 바깥 `<g transform>` 없이 `<foreignObject>`의 `x/y/width/height`로 위치·크기를 지정하고, 회전·반전은 안쪽 `<canvas>`의 CSS `transform`으로 처리. 이어서 슬라이드 3의 `<Hand>` 두 개도 transform이 걸린 `<g>` 밖으로 꺼내 좌표에 변환을 반영했다.
- **폐기 사유:** 조상 transform을 없애도 Safari에서는 손이 여전히 어긋났고(viewBox 스케일 미반영), 슬라이드 1은 캔버스 재그리기가 누락돼 애니메이션이 멈췄다. 호출부 좌표 환산(슬라이드 3의 계산식)은 새 구조에서도 그대로 유효하다.

# 모션 단축키 (motion-shortcut)

팀 "곰팡이" · 원티드 해커톤. 웹캠으로 한 손 제스처를 인식해 브라우저 안의 요리 모드 UI(영상 재생, 조리 단계, 타이머)를 조작하는 개인용 모션 인터페이스.

## 스택

- React 18 + TypeScript + Vite 7, 패키지 매니저 pnpm
- 손 인식: `@mediapipe/tasks-vision` 1.0.1의 `HandLandmarker` (VIDEO 모드, `numHands: 1`)
- 상태: zustand. 외부 UI 라이브러리 없음. 스타일은 단일 CSS(`src/App.css`)
- 테스트: vitest, `environment: node`. 인식 로직은 DOM 없이 좌표 배열만으로 테스트한다.

## 명령어

```bash
pnpm install
pnpm dev        # http://localhost:5173 (카메라는 localhost/HTTPS에서만 열림)
pnpm test       # vitest run
pnpm build      # tsc -b && vite build
pnpm typecheck
```

## 폴더 구조

```
src/
  vision/          카메라·HandLandmarker 래퍼. 브라우저 API에 의존하는 유일한 계층
    assets.ts      WASM/모델 URL 상수 (CDN → 로컬 번들 전환 지점)
    mirror.ts      x → 1-x 거울 변환. 좌우 반전이 일어나는 유일한 지점
  gesture/         순수 함수 파이프라인: 21개 랜드마크 → 제스처 이벤트
    config.ts      모든 임계값 (튜닝은 여기 + 개발 패널)
    normalize.ts   손목(0) 기준 평행이동, 손목–중지MCP(9) 거리로 스케일 정규화
    static.ts      정적 포즈(손바닥 펼침, 주먹)
    trajectory.ts  최근 N프레임 좌표 링 버퍼
    dynamic.ts     동적 제스처(스와이프, 원)
    stateMachine.ts 후보 → 유지 → 신뢰도 → 실행 예정 → 실행 → 쿨다운
    pipeline.ts    위를 합성하는 진입점
  commands/        Command/Mode 인터페이스와 레지스트리 (다른 모드는 확장 지점만)
  modes/cooking/   레시피 단계, YouTube 플레이어, 3분 타이머, 제스처↔명령 매핑
  store/           zustand 스토어 (gesture, cooking)
  ui/              웹캠 미리보기, 랜드마크 오버레이, HUD, 매핑 표, 실행 로그, 개발 패널
docs/
  DECISIONS.md     기술 결정 기록 (결정 / 대안 / 선택 이유 / 되돌릴 조건). 시행착오도 남긴다
  GESTURES.md      제스처별 판정 규칙·임계값·오작동 사례·튜닝 방법
  LEARNING.md      개념 정리 (비전공자용)
```

## 아키텍처 원칙

1. **인식 로직과 UI 분리.** `src/gesture/`는 브라우저 API를 import하지 않는다. 시간은 항상 인자로 받는다(`t: number`, ms).
2. **좌표계는 사용자 시점.** `vision/mirror.ts`에서 한 번 `x → 1 - x`를 적용한 뒤로는 모든 코드에서 사용자 오른쪽 = x 증가 = 화면 오른쪽. 미리보기 비디오는 CSS로 거울 표시하고, 오버레이 캔버스는 변환된 좌표를 그린다(뒤집지 않는다).
3. **임계값은 `gesture/config.ts` 한 곳.** 코드에 숫자를 직접 쓰지 않는다.
4. **상태 머신 7단계**: 후보 발견 → 유지/궤적 확인 → 신뢰도 확인 → 재실행 방지 → 실행 예정 표시 → 실행+이펙트+효과음 → 쿨다운. `fist`(활성화 토글)는 비활성 상태에서도 항상 처리한다.
5. **로그는 무시 사유까지.** 실행뿐 아니라 무시된 후보도 사유와 함께 화면과 `console.log`에 남긴다. 튜닝 근거가 된다.
6. **확장은 인터페이스로만.** 사용자 제스처 등록, 다른 모드, 두 손, Electron은 만들지 않는다. `Mode` 인터페이스가 확장 지점.

## 확정된 결정 (바꾸지 말 것)

- 브라우저 안의 기능만 제어. OS·다른 탭 제어 없음.
- 한 손 제스처만. 기본 동작 5개만 하드코딩.
- 실행 전 확인 단계 없음. 대신 활성화 on/off: 주먹 2초 + 화면 버튼 + `Ctrl+Shift+M`(macOS도 Cmd가 아닌 Ctrl).
- 조리 영상은 YouTube IFrame Player API.

## 브랜치 규칙

- `main` 보호. 작업은 `feat/<주제>` → PR → 리뷰 후 머지.
- 커밋은 기능 단위로 작게. 커밋 전 `pnpm test`와 `pnpm build` 통과 확인.
- 테스트하지 않은 것을 "테스트 완료"라고 쓰지 않는다. 카메라 실기 확인 항목은 PR 본문에 목록으로 적는다.

## 작업 시 규칙 (Claude Code용)

- 임계값을 바꿀 때는 `config.ts`의 `DEFAULT_CONFIG`와 `CONFIG_RANGES`를 함께 고치고, `docs/GESTURES.md`의 표도 갱신한다. 새 키를 추가하면 `config.test.ts`가 범위 누락을 잡는다.
- 새 판정 규칙을 넣으면 `src/gesture/__tests__/fixtures.ts`의 합성 손으로 테스트를 먼저 쓴다. 테스트가 실패하면 코드와 픽스처 둘 다 의심한다(T-002).
- 좌우 방향 버그는 임계값으로 고치지 않는다. `vision/mirror.ts`가 유일한 반전 지점인지부터 확인한다(D-003).
- 기술 결정을 내리면 `docs/DECISIONS.md`에 "결정 / 대안 / 선택 이유 / 되돌릴 조건"으로 적고, 막혔다 풀린 것은 "시행착오"에 적는다.
- `@mediapipe/tasks-vision` API를 새로 쓸 때는 `node_modules/@mediapipe/tasks-vision/vision.d.ts`를 읽고 쓴다. 문서보다 설치된 타입이 기준이다.
- 다른 브라우저 포트가 5173을 쓰면 `PORT=5174 pnpm dev`. `.claude/launch.json`은 Claude Code 브라우저 미리보기용이다.

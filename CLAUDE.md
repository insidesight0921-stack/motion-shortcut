# 모션 단축키 (motion-shortcut)

팀 "곰팡이" · 원티드 해커톤. 웹캠으로 한 손 제스처 5개를 인식해, 사용자가 연결해 둔 범용 명령(미디어 재생/이동, 타이머, 키 입력)을 브라우저 안에서 실행하는 개인용 모션 인터페이스. 특정 상황에 묶이지 않는 기본형이다(D-015).

## 스택

- React 18 + TypeScript + Vite 7, 패키지 매니저 pnpm
- 손 인식: `@mediapipe/tasks-vision` 1.0.1의 `HandLandmarker` (VIDEO 모드, `numHands: 1`)
- 상태: zustand. 외부 UI 라이브러리 없음. 스타일은 `src/styles/tokens.css`(토큰) + `src/styles/base.css`(공용) + `src/App.css`(화면)
- 테스트: vitest, `environment: node`. 인식 로직·명령·매핑은 DOM 없이 테스트한다.

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
  gesture/         순수 함수 파이프라인: 21개 랜드마크 → 제스처 이벤트 (수정 시 별도 합의)
    config.ts      모든 임계값 (튜닝은 여기 + 개발 패널)
    normalize.ts   손목(0) 기준 평행이동, 손목–중지MCP(9) 거리로 스케일 정규화
    static.ts      정적 포즈(손바닥 펼침, 주먹)
    trajectory.ts  최근 N프레임 좌표 링 버퍼
    dynamic.ts     동적 제스처(스와이프, 원)
    stateMachine.ts 후보 → 유지 → 신뢰도 → 실행 예정 → 실행 → 쿨다운
    pipeline.ts    위를 합성하는 진입점
  commands/        범용 명령
    types.ts       CommandDef, ParamSchema, CommandContext
    catalog.ts     명령 7개 (media.*, timer.toggle, key.press, none, system.toggleEnabled)
    registry.ts    파라미터 검증, runCommand, runMapping (executed / failed / ignored)
    keyPress.ts    키 조합 파서/포매터, KeyboardEvent 합성 (isTrusted 한계)
  mapping/         제스처 → 명령 매핑 데이터 (types, defaults, localStorage storage)
  targets/         명령의 데모 대상: youtube/ (플레이어), timer/ (범용 카운트다운)
  store/           zustand: gestureStore, mappingStore, targetStore, logStore
  ui/              CameraView, Hud, MappingEditor, KeyCaptureInput, LastKeyIndicator, EventLog, DevPanel, icons
  styles/          tokens.css, base.css, fonts.ts
docs/
  DESIGN.md        단일 디자인 기준 (+ 적용 노트)
  DECISIONS.md     기술 결정 기록 (결정 / 대안 / 선택 이유 / 되돌릴 조건). 시행착오도 남긴다
  GESTURES.md      기본 매핑, 제스처별 판정 규칙·임계값·오작동 사례·튜닝 방법
  LEARNING.md      개념 정리 (비전공자용)
```

## 아키텍처 원칙

1. **인식 로직과 UI 분리.** `src/gesture/`는 브라우저 API를 import하지 않는다. 시간은 항상 인자로 받는다(`t: number`, ms).
2. **좌표계는 사용자 시점.** `vision/mirror.ts`에서 한 번 `x → 1 - x`를 적용한 뒤로는 모든 코드에서 사용자 오른쪽 = x 증가 = 화면 오른쪽. 미리보기 비디오는 CSS로 거울 표시하고, 오버레이 캔버스는 변환된 좌표를 그린다(뒤집지 않는다).
3. **임계값은 `gesture/config.ts` 한 곳.** 코드에 숫자를 직접 쓰지 않는다.
4. **상태 머신 7단계**: 후보 발견 → 유지/궤적 확인 → 신뢰도 확인 → 재실행 방지 → 실행 예정 표시 → 실행+이펙트+효과음 → 쿨다운. `fist`(활성화 토글)는 비활성 상태에서도 항상 처리하며 **엔진이 직접 토글**한다(명령 계층이 아님).
5. **명령은 카탈로그 → 매핑 → 레지스트리.** 새 명령은 `commands/catalog.ts`에 한 항목만 추가하면 편집기·검증·저장이 따라온다. 명령은 `targetStore`를 통해서만 대상을 만진다.
6. **로그는 세 종류.** 실행 / 실행 실패(명령이 ok:false) / 무시(상태 머신 사유, 키 캡처 중, 명령 없음). 사유를 화면과 `console.log`에 남긴다.
7. **확장은 인터페이스로만.** 사용자 정의 제스처, 프리셋, 확장 프로그램, 다른 탭 제어는 만들지 않는다. 프리셋이 필요해지면 `mapping/presets/`.

## 확정된 결정 (바꾸지 말 것)

- 브라우저 안의 기능만 제어. OS·다른 탭 제어 없음. `key.press`는 이 페이지 안의 리스너에만 동작한다(isTrusted).
- 한 손 제스처 5개만. 인식 파라미터는 T-003~T-009 튜닝값 유지.
- **주먹 = 활성화 on/off 고정.** 매핑 편집 불가, 저장소가 항상 고정값으로 덮어쓴다. `fistHoldMs`는 1.2초 아래로 내리지 않는다(T-009).
- 실행 전 확인 단계 없음. 활성화 토글: 주먹 유지 + 화면 버튼 + `Ctrl+Shift+M`(macOS도 Cmd가 아닌 Ctrl).
- 데모 대상은 YouTube 임베드 하나 + 타이머 + 마지막 키 표시.

## 브랜치 규칙

- `main` 보호. 작업은 `feat/<주제>` → PR → 리뷰 후 머지.
- 커밋은 기능 단위로 작게. 커밋 전 `pnpm test`와 `pnpm build` 통과 확인.
- 테스트하지 않은 것을 "테스트 완료"라고 쓰지 않는다. 카메라 실기 확인 항목은 PR 본문에 목록으로 적는다.

## 작업 시 규칙 (Claude Code용)

- **UI 코드를 쓰기 전에 `docs/DESIGN.md`를 읽고 §10 체크리스트 10개 항목을 통과시킬 것.** 색·간격·radius·폰트 크기·모션은 `src/styles/tokens.css`의 토큰만 쓴다. 원시 hex와 스케일 밖 px 금지. DESIGN.md에 없는 값이 필요하면 만들지 말고 사용자에게 묻는다.
- 임계값을 바꿀 때는 `config.ts`의 `DEFAULT_CONFIG`와 `CONFIG_RANGES`를 함께 고치고, `docs/GESTURES.md`의 표도 갱신한다. 새 키를 추가하면 `config.test.ts`가 범위 누락을 잡는다.
- 새 판정 규칙을 넣으면 `src/gesture/__tests__/fixtures.ts`의 합성 손으로 테스트를 먼저 쓴다. 테스트가 실패하면 코드와 픽스처 둘 다 의심한다(T-002).
- 좌우 방향 버그는 임계값으로 고치지 않는다. `vision/mirror.ts`가 유일한 반전 지점인지부터 확인한다(D-003).
- 새 명령을 추가하면 `catalog.ts` 항목 + `registry.test.ts`의 검증 케이스 + `storage.test.ts`의 정규화 케이스를 함께 쓴다. `system.*` 명령은 `assignable: false`.
- 기술 결정을 내리면 `docs/DECISIONS.md`에 "결정 / 대안 / 선택 이유 / 되돌릴 조건"으로 적고, 막혔다 풀린 것은 "시행착오"에 적는다.
- `@mediapipe/tasks-vision` API를 새로 쓸 때는 `node_modules/@mediapipe/tasks-vision/vision.d.ts`를 읽고 쓴다. 문서보다 설치된 타입이 기준이다.
- 다른 브라우저 포트가 5173을 쓰면 `PORT=5174 pnpm dev`. `.claude/launch.json`은 Claude Code 브라우저 미리보기용이다.

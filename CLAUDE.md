# 모션 단축키 (motion-shortcut) → Flickey

팀 "곰팡이" · 원티드 해커톤. 제품은 **Flickey — 발표자용 개인 맞춤형 모션 프레젠테이션 인터페이스**로 확정됐다(`docs/PRODUCT.md`, D-017). 현재 코드는 범용 명령+모드 시스템 상태이며 기획서 §25 순서로 단계 전환 중이다. 아래 구조 설명은 전환이 진행되면서 갱신한다.

- 두 프로세스: 웹앱(이 레포) + 로컬 에이전트(팀원, 별도 코드). 계약은 `docs/AGENT-PROTOCOL.md`. 이 레포는 명세와 모의 에이전트(`tools/mock-agent/`)까지만.
- 디자인 두 체계: 발표 전 화면 `docs/DESIGN.md`, 발표 중 오버레이 `docs/DESIGN-OVERLAY.md`(`src/ui/overlay/`, `--ov-*` 토큰만).
- `standby` = `MOTION OFF`(같은 상태). 우선순위 `standby > 활성화 off(주먹 옵션일 때만) > 실행`.
- 진행: 1차(발표 제어 기반) 완료. 다음은 2차 모드 시스템(커서·레이저·검지 교차 전환·DESIGN-OVERLAY 적용).

## 스택

- React 18 + TypeScript + Vite 7, 패키지 매니저 pnpm
- 손 인식: `@mediapipe/tasks-vision` 1.0.1의 `HandLandmarker` (VIDEO 모드, `numHands: 2`. 한 손만 보이면 기존 한 손 경로)
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
    handedness.ts  MediaPipe Left/Right → 사용자 기준 손. 라벨 반전이 일어나는 유일한 지점 (HANDEDNESS_FLIP)
    session.ts     numHands 2, VisionTick.hands (모든 손) + frame (첫 손, 호환)
  gesture/         한 손 순수 파이프라인 (수정 금지, 테스트 102개 불변) + 양손 추가 모듈
    config.ts      모든 임계값 (한 손 + 양손 키). 튜닝은 여기 + 개발 패널
    normalize/static/trajectory/dynamic/stateMachine/pipeline.ts   한 손 (D-003~T-009)
    twoHands.ts    (추가) pairHands, x_cross / index_cross 판정, pickPrimaryHand
    modeGesture.ts (추가) stepMotionToggle: 양손 X 유지 → MOTION OFF 토글. 2차에 진입→방향 시퀀스 추가
  commands/        발표 명령
    types.ts       CommandDef(risk 포함), ParamSchema, CommandContext
    catalog.ts     slide.next/prev/first/goto/start/blackout/return, key.press, none, system.toggleEnabled
    programs.ts    PowerPoint/Keynote/Google Slides × darwin/win32 단축키 표 (실측 전 초기값)
    programProvider.ts 활성 프로그램 주입점 (catalog ↔ profileStore 순환 회피, T-010)
    registry.ts    파라미터 검증, runCommand, runMapping (executed / failed / ignored)
    keyPress.ts    키 조합 파서/포매터, 페이지 안 합성 이벤트 (폴백)
  agent/           로컬 에이전트 연결 (docs/AGENT-PROTOCOL.md 구현)
    protocol.ts    메시지 타입·검증·encode
    client.ts      WebSocket 클라이언트: hello 게이트, id 매칭, 타임아웃, 백오프, ping
    dispatch.ts    실행 출구: 에이전트 우선(KeyTransport), 없으면 페이지 폴백, 비동기 실패 통지
  mapping/         Mapping 타입·정규화, 옛 v1 저장 형식 (마이그레이션 원본)
  profile/         Profile 모델(v3), 기본값, 저장, v1/v2 → v3 마이그레이션
  modes/           ModeDef 카탈로그: slide/cursor/laser/asset + standby(=MOTION OFF)
  voice/           Web Speech 래퍼 (실험 기능, 기본 꺼짐, 설정 하단에서만)
  store/           zustand: gestureStore, modeStore(전환·게이트), profileStore, agentStore, logStore, uiStore
  ui/              CameraView, Hud, ModeSwitcher, Home, ProfileSettings, GestureSettings(+MappingEditor),
                   StandbyScreen(+presentation.ts), AgentPanel, EventLog, DevPanel, KeyCaptureInput, icons
    overlay/       (2차) 발표 중 오버레이. docs/DESIGN-OVERLAY.md 토큰만
  styles/          tokens.css, base.css, fonts.ts (+ 2차 overlay.css)
tools/mock-agent/  모의 에이전트 (pnpm mock-agent)
docs/
  PRODUCT.md       제품 기획서 (Flickey §1~§28). 전환은 D-017, 단계는 §25 순서
  AGENT-PROTOCOL.md 웹앱 ↔ 로컬 에이전트 WebSocket 계약 v1 (팀원에게 그대로 전달)
  DESIGN.md        발표 전 화면(홈·프로필·리허설·설정·대기·로그)의 디자인 기준 (+ 적용 노트)
  DESIGN-OVERLAY.md 발표 중 오버레이(손 피드백·모드 발광·레이저·미니 패널) 기준. 글로우 허용의 명시적 예외
  DECISIONS.md     기술 결정 기록 (결정 / 대안 / 선택 이유 / 되돌릴 조건). 시행착오도 남긴다
  GESTURES.md      기본 매핑, 제스처별 판정 규칙·임계값·오작동 사례·튜닝 방법
  LEARNING.md      개념 정리 (비전공자용)
```

## 아키텍처 원칙

1. **인식 로직과 UI 분리.** `src/gesture/`는 브라우저 API를 import하지 않는다. 시간은 항상 인자로 받는다(`t: number`, ms).
2. **좌표계는 사용자 시점.** `vision/mirror.ts`에서 한 번 `x → 1 - x`를 적용한 뒤로는 모든 코드에서 사용자 오른쪽 = x 증가 = 화면 오른쪽. 미리보기 비디오는 CSS로 거울 표시하고, 오버레이 캔버스는 변환된 좌표를 그린다(뒤집지 않는다).
3. **임계값은 `gesture/config.ts` 한 곳.** 코드에 숫자를 직접 쓰지 않는다.
4. **상태 머신 7단계**: 후보 발견 → 유지/궤적 확인 → 신뢰도 확인 → 재실행 방지 → 실행 예정 표시 → 실행+이펙트+효과음 → 쿨다운. `fist`(활성화 토글)는 비활성 상태에서도 항상 처리하며 **엔진이 직접 토글**한다(명령 계층이 아님).
5. **명령은 카탈로그 → 매핑 → 레지스트리 → 실행 출구.** 새 명령은 `commands/catalog.ts`에 한 항목만 추가하면 편집기·검증·저장이 따라온다. 키를 내보내는 명령은 `agent/dispatch.ts`만 거친다(에이전트 우선, 페이지 폴백). 명령은 스토어를 직접 import 하지 않는다(T-010).
6. **로그는 세 종류.** 실행 / 실행 실패(명령이 ok:false) / 무시(상태 머신 사유, 키 캡처 중, 명령 없음). 사유를 화면과 `console.log`에 남긴다.
7. **모드 = 프로필 안의 매핑 묶음. standby = MOTION OFF.** 전환 경로(양손 검지 교차(2차)·화면·키보드·실험적 음성)는 공존한다. MOTION OFF 에서는 주먹 포함 모든 한 손 제스처가 무시되고 켜는 경로는 양손 X·화면·키보드뿐(`modeStore.gestureGate`, D-017). 전환 쿨다운·궤적 초기화·양손 판정은 `useGestureEngine`(ui/)에서 처리하고 `gesture/` 한 손 파일은 건드리지 않는다.
8. **에이전트 경계.** 이 레포는 프로토콜 명세 + 클라이언트 + 모의 에이전트까지. OS 입력·커서·레이저 창은 팀원의 에이전트. 프로토콜에 삭제·이동·종료 메시지를 넣지 않는다.
9. **확장은 인터페이스로만.** 사용자 정의 제스처(`ModeDef.customGestures` 자리만, 5차), 커서·레이저(2차), 자료(3차), 리허설(4차)은 해당 차수에서만.

## 확정된 결정 (바꾸지 말 것)

- OS 제어는 로컬 에이전트만 한다. 웹앱의 페이지 안 폴백(`key.press` 합성 이벤트)은 이 페이지 밖으로 나가지 않는다(isTrusted).
- 한 손 제스처 5개 + 양손 X(1차) / 양손 검지 교차(2차). 한 손 인식 파라미터는 T-003~T-009 튜닝값 유지.
- **모션 기본 OFF.** 세션은 standby(MOTION OFF)에서 시작. 켜기/끄기는 양손 X 1초(기본) 또는 주먹 1.2초(프로필 설정 대안). `fistHoldMs`는 1.2초 아래로 내리지 않는다(T-009). 주먹 매핑은 편집 불가.
- 모드 순서 고정: slide(기본), cursor, laser, asset (+ standby). 전환 방향: ↓ 슬라이드, ← 커서, → 레이저, ↑ 자료. 커서 모드에서 슬라이드 제스처 비활성, 레이저는 시스템 커서를 움직이지 않는다(2차).
- 음성은 실험 기능(프로필 설정 하단, 기본 꺼짐). 모드 전환·MOTION OFF 해제에만 쓰고 명령 실행에는 쓰지 않는다.
- 발표 시작 = `wake('ui')`(standby → 이전 사용자 모드), 발표 종료 = `standby('ui')`. 카메라가 꺼져 있으면 발표 시작은 disabled. 화면당 primary 버튼은 한 시점에 하나.
- 리허설은 통계만 저장(영상 저장 금지, §18). 프로필 삭제 시 함께 삭제.

## 브랜치 규칙

- `main` 보호. 작업은 `feat/<주제>` → PR → 리뷰 후 머지.
- 커밋은 기능 단위로 작게. 커밋 전 `pnpm test`와 `pnpm build` 통과 확인.
- 테스트하지 않은 것을 "테스트 완료"라고 쓰지 않는다. 카메라 실기 확인 항목은 PR 본문에 목록으로 적는다.

## 작업 시 규칙 (Claude Code용)

- **UI 코드를 쓰기 전에 `docs/DESIGN.md`를 읽고 §10 체크리스트 10개 항목을 통과시킬 것.** 색·간격·radius·폰트 크기·모션은 `src/styles/tokens.css`의 토큰만 쓴다. 원시 hex와 스케일 밖 px 금지. DESIGN.md에 없는 값이 필요하면 만들지 말고 사용자에게 묻는다.
- 임계값을 바꿀 때는 `config.ts`의 `DEFAULT_CONFIG`와 `CONFIG_RANGES`를 함께 고치고, `docs/GESTURES.md`의 표도 갱신한다. 새 키를 추가하면 `config.test.ts`가 범위 누락을 잡는다.
- 새 판정 규칙을 넣으면 `src/gesture/__tests__/fixtures.ts`의 합성 손으로 테스트를 먼저 쓴다. 테스트가 실패하면 코드와 픽스처 둘 다 의심한다(T-002).
- 좌우 방향 버그는 임계값으로 고치지 않는다. `vision/mirror.ts`가 유일한 반전 지점인지부터 확인한다(D-003).
- 새 명령을 추가하면 `catalog.ts` 항목(+ `risk`) + `registry.test.ts`의 검증 케이스 + `profile/migrate.ts`의 `SLIDE_ALLOWED_COMMANDS`(슬라이드 모드에 남길 수 있으면) 를 함께 쓴다. `system.*` 명령은 `assignable: false`.
- 에이전트 메시지를 추가·변경하면 `docs/AGENT-PROTOCOL.md` → `agent/protocol.ts` → `tools/mock-agent` → 테스트 순으로 같은 커밋에서 맞춘다. 문서가 계약이다.
- 양손 판정을 바꾸면 `fixtures.ts`의 `placeHands`로 테스트를 먼저 쓰고, 교차 기하가 헷갈리면 숫자 스윕으로 확인한다(T-011).
- 음성 별칭을 늘릴 때는 `modes/catalog.ts`의 `voiceAliases`(모드) 또는 `voice/keywords.ts`(대기·해제)에 넣고 `keywords.test.ts`의 "별칭 전부" 테스트가 자동으로 검사하게 둔다. "모드"가 붙은 별칭은 포함 매칭, 단독 단어는 완전 일치라는 규칙을 유지한다.
- 저장 형식을 바꾸면 `version`을 올리고 이전 버전 읽기 경로를 `mapping/storage.ts`에 남긴다(D-016 마이그레이션 패턴).
- 기술 결정을 내리면 `docs/DECISIONS.md`에 "결정 / 대안 / 선택 이유 / 되돌릴 조건"으로 적고, 막혔다 풀린 것은 "시행착오"에 적는다.
- `@mediapipe/tasks-vision` API를 새로 쓸 때는 `node_modules/@mediapipe/tasks-vision/vision.d.ts`를 읽고 쓴다. 문서보다 설치된 타입이 기준이다.
- 다른 브라우저 포트가 5173을 쓰면 `PORT=5174 pnpm dev`. `.claude/launch.json`은 Claude Code 브라우저 미리보기용이다.

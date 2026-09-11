# Flickey 에이전트 프로토콜 v1

> 웹앱(이 레포)과 로컬 에이전트(별도 네이티브 프로그램) 사이의 계약. 에이전트 구현자는 이 문서만 보고 만들 수 있어야 한다.
> 웹앱 쪽 구현: `src/agent/protocol.ts`(타입·검증), `src/agent/client.ts`(연결). 모의 에이전트: `tools/mock-agent/` (`pnpm mock-agent`).

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 전송 | WebSocket, `ws://127.0.0.1:41777` (포트는 웹앱 설정에서 변경 가능) |
| 역할 | **에이전트 = 서버**, 웹앱 = 클라이언트 |
| 인코딩 | 텍스트 프레임, UTF-8 JSON, **메시지 하나당 프레임 하나** |
| 버전 | 모든 메시지에 `"v": 1` |
| 인증 | 없음. 루프백 주소만 바인딩할 것 (`127.0.0.1`, `0.0.0.0` 금지) |
| 요청 응답 | 웹앱 요청은 `id`(UUID v4)를 갖고, 에이전트는 같은 `id`로 **정확히 한 번** 응답 |
| 타임아웃 | 웹앱은 1500ms 안에 응답이 없으면 실패 처리 |
| 없는 것 | 삭제·이동·종료·앱 닫기·화면 공유 종료 메시지는 **존재하지 않는다** |

## 1. 연결 수명

1. 에이전트가 먼저 떠서 `127.0.0.1:41777`에서 기다린다.
2. 웹앱이 연결한다. 연결이 열리면 **에이전트가 먼저 `hello`를 보낸다.** 웹앱은 `hello`를 받기 전에는 어떤 요청도 보내지 않는다.
3. `hello`의 `capabilities`에 없는 종류의 요청은 웹앱이 보내지 않는다(예: `laser`가 없으면 페이지 안 레이저 폴백 사용).
4. 끊기면 웹앱은 1s → 2s → 4s → 8s(최대) 간격으로 재연결을 시도한다. 끊긴 동안 웹앱은 **페이지 안 폴백**으로 동작하고 화면에 "에이전트 없음 · 페이지 안 폴백"을 표시한다. 폴백은 발표 프로그램에 닿지 않는다(브라우저 합성 키 이벤트의 `isTrusted=false` 한계). 웹앱 단독 데모용이다.
5. 웹앱은 30초마다 `ping`을 보내고 `pong`이 두 번 연속 없으면 연결을 끊고 재연결한다.

## 2. 공통 규칙

- 알 수 없는 필드는 무시한다(전방 호환). 알 수 없는 `type`은 `{ ok:false, error:"unsupported_type" }`.
- `v`가 1이 아니면 `{ ok:false, error:"unsupported_version" }`.
- JSON 파싱 실패·필수 필드 누락은 `{ ok:false, error:"invalid_message" }` (id를 알 수 있으면 포함).
- 좌표 `x`, `y`는 **주 디스플레이의 비율 0~1**, 좌상단이 원점이다. 카메라 좌표가 아니다. 카메라 → 화면 매핑(활동 범위 정규화, 민감도, 데드존)은 웹앱 책임이다. 다중 디스플레이에서 어느 화면을 쓸지는 `hello.displays`의 `primary`를 기본으로 하고, 이후 버전에서 `display` 필드로 지정한다.
- `ack: false`가 붙은 메시지(`cursor move`, `laser move`)는 응답을 생략해도 된다. 에이전트는 초당 30개를 넘는 move를 버려도 된다.

## 3. 웹앱 → 에이전트

### 3.1 `key` — 키 조합 입력

```json
{ "v": 1, "id": "3f2a…", "type": "key", "combo": "ArrowRight" }
```

- `combo` 문법: `[Ctrl+][Alt+][Shift+][Meta+]<Key>`. 수식키 순서는 이대로 고정. `<Key>`는 `KeyboardEvent.key` 이름(`ArrowRight`, `Escape`, `Enter`, `Home`, `F5`, `B`, `Space`, `1`…). 한 글자 키는 대문자.
- 에이전트는 현재 **포커스된 앱**에 그대로 보낸다. 어느 앱인지 판단하지 않는다.
- macOS에서 `Meta`는 ⌘, `Alt`는 ⌥. Windows에서 `Meta`는 Win 키.
- 발표 프로그램별 단축키 표는 웹앱이 갖는다(`src/commands/programs.ts`). 에이전트는 표를 몰라도 된다.

### 3.2 `cursor` — 시스템 커서

```json
{ "v": 1, "id": "…", "type": "cursor", "action": "move",  "x": 0.42, "y": 0.31, "ack": false }
{ "v": 1, "id": "…", "type": "cursor", "action": "click", "button": "left" }
{ "v": 1, "id": "…", "type": "cursor", "action": "scroll", "dy": -3 }
```

- `move`: 절대 위치. 최대 30/s.
- `click`: MVP는 `left`만. 더블클릭·드래그·우클릭 없음.
- `scroll`: 줄 단위, 양수 = 아래. 2차 이후.
- macOS 손쉬운 사용 권한이 없으면 `{ ok:false, error:"accessibility_permission_missing" }`.

### 3.3 `laser` — 레이저 오버레이 (항상 위 투명 창)

```json
{ "v": 1, "id": "…", "type": "laser", "action": "show", "x": 0.5, "y": 0.5, "emphasis": 0 }
{ "v": 1, "id": "…", "type": "laser", "action": "move", "x": 0.52, "y": 0.49, "emphasis": 0, "ack": false }
{ "v": 1, "id": "…", "type": "laser", "action": "move", "x": 0.52, "y": 0.49, "emphasis": 1, "ack": false }
{ "v": 1, "id": "…", "type": "laser", "action": "hide" }
```

- **레이저는 시스템 커서를 절대 움직이지 않는다.** 오버레이 창은 클릭을 통과시켜야 한다(click-through).
- `emphasis: 1`은 강조 원 확대(주먹 쥠). 잔상·정지 시 강조는 에이전트가 그린다. 색·크기는 `panel.state.laser`로 전달(2차).
- 전체 화면 공유에서만 참석자에게 보인다(§23). 창 하나만 공유하면 보이지 않을 수 있다는 안내는 웹앱이 한다.

### 3.4 `open` — 등록된 자료 실행 (3차)

```json
{ "v": 1, "id": "…", "type": "open", "target": { "kind": "url", "value": "https://example.com/pricing", "label": "가격표" } }
{ "v": 1, "id": "…", "type": "open", "target": { "kind": "file", "value": "/Users/me/Documents/deck.pdf", "label": "가격표 PDF" } }
{ "v": 1, "id": "…", "type": "open", "target": { "kind": "app",  "value": "com.apple.Safari", "label": "Safari" } }
```

- **이중 검증.** 웹앱은 현재 프로필의 `assets`에 등록된 항목만 보낸다. 에이전트는 `whitelist`(3.6)로 받은 목록에 없는 값을 `{ ok:false, error:"not_whitelisted" }`로 거부한다. 둘 중 하나만 통과해서는 실행되지 않는다.
- `app`의 `value`는 macOS 번들 ID 또는 Windows 실행 파일 경로. 에이전트가 `hello.platform`에 맞게 해석한다.
- 이미 열려 있으면 앞으로 가져오기만 한다(새 인스턴스 금지).

### 3.5 `panel` — 발표 중 미니 패널 상태

```json
{ "v": 1, "id": "…", "type": "panel", "state": {
    "mode": "slide", "motion": "on", "camera": "on",
    "candidate": "오른쪽 스와이프", "progress": 0.4,
    "lastCommand": "다음 슬라이드", "lastCommandAt": 1757570000000,
    "laser": { "size": "md", "color": "blue" } } }
```

- `mode`: `slide` | `cursor` | `laser` | `asset` | `standby`. `standby`이면 `motion`은 항상 `off`(같은 상태다, D-017).
- 웹앱은 상태가 바뀔 때만 보낸다(최대 10/s). 에이전트는 마지막 값을 표시하고, `progress`(0~1)를 게이지로 그린다.
- 패널은 항상 위, 작게, 발표 자료를 가리지 않는 위치. 디자인은 `docs/DESIGN-OVERLAY.md`.

### 3.6 `whitelist` — 자료 화이트리스트 동기화 (3차)

```json
{ "v": 1, "id": "…", "type": "whitelist", "items": [ { "kind": "url", "value": "https://example.com/pricing" }, { "kind": "file", "value": "/Users/me/Documents/deck.pdf" } ] }
```

- 프로필을 저장할 때와 연결 직후(`hello` 수신 후)에 전체 목록을 보낸다. 부분 갱신 없음. 에이전트는 마지막 목록으로 **교체**한다.

### 3.7 `ping`

```json
{ "v": 1, "id": "…", "type": "ping" }
```

## 4. 에이전트 → 웹앱

### 4.1 `hello` — 연결 직후 1회

```json
{ "v": 1, "type": "hello",
  "agent": "flickey-agent/0.1.0",
  "platform": "darwin",
  "capabilities": ["key", "cursor", "laser", "open", "panel"],
  "permissions": { "accessibility": true, "screenRecording": null },
  "displays": [ { "id": 0, "w": 2560, "h": 1440, "primary": true } ] }
```

- `platform`: `darwin` | `win32` | `linux`.
- `capabilities`: 구현한 요청 종류만. 웹앱은 여기 없는 종류를 보내지 않는다.
- `permissions.accessibility`: macOS 손쉬운 사용(커서·키 입력에 필요). Windows는 `true`. `screenRecording`은 해당 없으면 `null`.

### 4.2 응답

```json
{ "v": 1, "id": "3f2a…", "ok": true }
{ "v": 1, "id": "3f2a…", "ok": false, "error": "accessibility_permission_missing", "message": "시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용에서 Flickey Agent 를 허용하세요" }
```

`error` 코드 목록:

| 코드 | 뜻 | 웹앱 표시 |
|---|---|---|
| `accessibility_permission_missing` | 커서·키 입력 권한 없음 | "실행 실패 · 손쉬운 사용 권한 없음" + 설정 경로 |
| `not_whitelisted` | 등록되지 않은 자료 | "실행 실패 · 등록되지 않은 자료" (웹앱 버그로 간주, 로그) |
| `unsupported_type` | 모르는 type | "실행 실패 · 에이전트 미지원" |
| `unsupported_version` | v 불일치 | 연결 화면에 버전 안내 |
| `invalid_message` | 형식 오류 | 로그만 |
| `internal` | 에이전트 내부 오류 | `message` 그대로 표시 |

### 4.3 `permissions` — 권한 변경 통지

```json
{ "v": 1, "type": "permissions", "permissions": { "accessibility": false, "screenRecording": null } }
```

권한이 바뀌면(사용자가 설정에서 껐다 켬) 능동적으로 보낸다. 웹앱은 대기 화면의 권한 표시를 갱신한다.

### 4.4 `panic` — 에이전트 쪽 긴급 정지

```json
{ "v": 1, "type": "panic" }
```

에이전트의 긴급 정지 버튼(미니 패널 또는 전역 단축키). 웹앱은 즉시 `standby`(= MOTION OFF)로 들어가고, 진행 중인 후보를 취소하고, 로그에 `에이전트 긴급 정지`를 남긴다. 에이전트는 그 시점 이후의 요청을 모두 `{ ok:false, error:"internal", message:"panic" }`으로 거부하다가 사용자가 패널에서 해제하면 `permissions` 메시지로 복귀를 알린다(해제 통지는 `{ "type":"permissions" }`를 재사용).

### 4.5 `pong`

```json
{ "v": 1, "type": "pong", "id": "…" }
```

## 5. 시퀀스 예시

```
웹앱                                  에이전트
  |------ TCP/WS connect ------------->|
  |<----- hello ----------------------|
  |------ whitelist ------------------>|   (프로필에 자료가 있을 때)
  |<----- {ok:true} ------------------|
  |------ panel {mode:standby,motion:off} -->|
  |   … 사용자가 양손 X 유지 → 웹앱 standby 해제 …
  |------ panel {mode:slide,motion:on} ---->|
  |------ key ArrowRight (id A) ------>|
  |<----- {id A, ok:true} ------------|
  |------ laser show 0.5 0.5 (id B) -->|
  |------ laser move … ack:false ----->|   (응답 없음)
  |<----- panic ----------------------|   (에이전트 버튼)
  |------ panel {mode:standby,motion:off} -->|
```

## 6. 모의 에이전트 (`tools/mock-agent/`)

- Node 스크립트, 의존성 `ws`. `pnpm mock-agent`로 41777에서 대기.
- 받은 메시지를 한 줄 JSON으로 콘솔에 찍고 `{ ok:true }`로 응답. `hello`에는 전체 capabilities와 `permissions.accessibility: true`.
- 실행 옵션: `--deny-accessibility`(권한 없음 시뮬레이션), `--drop-rate 0.1`(응답 유실로 타임아웃 테스트), `--panic-after 20`(20번째 메시지 뒤 panic 전송).
- 실제 OS 입력은 하지 않는다. 팀원의 실제 에이전트는 이 문서의 계약을 그대로 구현한다.

## 7. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 1 (초안) | 2026-09-11 | 최초. `whitelist`·`permissions`·`pong` 추가(웹앱 0단계 계획에서 합의) |

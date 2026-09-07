# 제스처 판정 규칙

> 모든 수치는 **튜닝 대상 초기값**이다. 실제 값은 `src/gesture/config.ts`가 기준이며, 개발 패널(화면 우하단 토글)에서 실시간으로 바꿀 수 있다.

## 좌표계

- HandLandmarker가 주는 21개 랜드마크의 x, y는 0~1 정규화 좌표(이미지 폭·높이 기준).
- `vision/mirror.ts`에서 `x → 1 - x`를 적용해 **사용자 시점 프레임**으로 바꾼다. 이후 모든 규칙에서 "오른쪽"은 사용자의 오른쪽이고, 화면(거울 미리보기)에서도 오른쪽이다.
- 랜드마크 인덱스: 0 손목, 1~4 엄지(4가 끝), 5~8 검지(5 MCP, 6 PIP, 7 DIP, 8 끝), 9~12 중지, 13~16 약지, 17~20 새끼.

## 정규화 (정적 포즈용)

1. 모든 점에서 손목(0)을 뺀다 → 손목이 원점.
2. 손목–중지 MCP(9) 거리를 1로 맞춘다 → 손 크기·카메라 거리 무관.

## 정적 포즈

코드: `src/gesture/static.ts`. 입력은 정규화 좌표.

### 손가락 펼침/접힘 (검지·중지·약지·새끼)

- 비율 `r = dist(끝, 손목) / dist(PIP, 손목)`
- `r ≥ fingerExtendRatio`(1.05) → 펼침. `r ≤ fingerFoldRatio`(0.95) → 접힘. 그 사이는 애매 구간(어느 쪽도 아님).
- 두 임계값을 다르게 둔 이유: 하나만 두면 경계에서 프레임마다 펼침/접힘이 깜빡인다(히스테리시스).

### 엄지 (D-004)

- 마진 `m = dist(엄지끝 4, 새끼MCP 17) − dist(엄지IP 3, 새끼MCP 17)`
- `m ≥ thumbExtendMargin`(0.1) → 펼침. 왼손/오른손, 거울 여부, 손 기울기에 무관하다.

### 손바닥 펼치기 `open_palm`

- 조건: 엄지 포함 5개 모두 펼침
- 점수: 손가락별로 `0.5 + (r − fingerExtendRatio) / (2·poseSoftMargin)`을 0~1로 자르고, 엄지는 마진으로 같은 식. 다섯 값 중 **최솟값**이 포즈 점수.
- 상태 머신에서 `score ≥ minPoseScore`(0.6)이어야 후보로 인정. 즉 기본값 기준 모든 손가락이 임계값보다 0.03 이상 여유 있어야 한다.
- 유지 시간: `palmHoldMs` 500ms

### 주먹 `fist`

- 조건: 엄지 **제외** 4개 모두 접힘(`r ≤ fingerFoldRatio`). 엄지는 밖에 있든(따봉) 안에 있든 무관.
- 점수: `0.5 + (fingerFoldRatio − r) / (2·poseSoftMargin)`의 최솟값.
- 유지 시간: `fistHoldMs` 2000ms. 비활성 상태에서도 항상 인식된다(잠금 해제 경로).

### 검증된 것 / 안 된 것

- 합성 좌표 유닛 테스트로 확인: 위치·크기 불변, ±60° 기울기, 좌우 반전(왼손), 따봉=주먹, 엄지 접은 손≠손바닥, 검지만 편 손=없음.
- **실기 미확인**: 실제 카메라의 랜드마크 떨림, 손이 카메라를 비스듬히 볼 때(원근으로 손가락이 짧아 보임) 비율이 1 근처로 내려오는 문제. 이 경우 `fingerExtendRatio`를 낮추거나 `poseSoftMargin`을 넓히는 것이 첫 번째 튜닝 후보.

## 동적 제스처

코드: `src/gesture/dynamic.ts`. 입력은 `TrajectoryBuffer`의 프레임 열(사용자 시점, **정규화 전** 좌표). 거리는 창 안 평균 손 크기로 나눠 "손 크기 배수"로 비교한다.

공통 전제: 창 안에서 프레임 간격이 `trackingMaxGapMs`(150ms)를 넘거나, 마지막 프레임이 그만큼 오래됐으면(손 사라짐) 판정하지 않는다.

### 스와이프 `swipe_left` / `swipe_right`

- 관측점: 손바닥 중심(손목·네 MCP 평균). 손가락 모양과 무관하게 안정적.
- 창: 최근 `swipeWindowMs`(500ms), 최소 지속 `swipeMinDurationMs`(120ms), 최소 3프레임.
- 조건 (모두 만족):
  1. `|dx| ≥ swipeMinDistance`(2.0 손 크기). dx = 마지막 − 처음.
  2. 수직 편차: `max(|net dy|, 시작–끝 직선에서 벗어난 최대 수직 거리) / |dx| ≤ swipeMaxYRatio`(0.35)
  3. 직진성: `|dx| / Σ|Δx| ≥ swipeMinStraightness`(0.75). 왕복하면 낮아진다.
  4. 포인팅 손 비율 `≤ swipeMaxPointingFraction`(0.5). 검지만 편 손은 원을 그리는 손이므로 스와이프에서 제외.
- 방향: **dx > 0 → `swipe_right`(사용자 오른쪽)**. 좌표계가 이미 사용자 시점이라 부호 그대로다.
- 점수: `0.5 + 0.5 × (거리 여유 + 수평성 + 직진성)/3`. 조건을 통과하면 최소 0.5. 상태 머신은 `minDynamicScore`(0.5)와 비교.

### 원 `circle`

- 관측점: 검지 끝(8).
- 창: 최근 `circleWindowMs`(1500ms), 최소 8프레임.
- 조건:
  1. 궤적 중심(평균) 기준 **부호 있는** 누적 회전각 `|Σ Δθ| ≥ circleMinAngleDeg`(300°). Δθ는 (−180°, 180°]로 감아서 더한다. 좌우 흔들기는 +와 −가 상쇄되어 0 근처가 된다.
  2. 평균 반지름 `≥ circleMinRadius`(0.5 손 크기)
  3. 반지름 변동계수(표준편차/평균) `≤ circleMaxRadiusCv`(0.35)
- 방향은 명령에 쓰지 않지만 `detail.direction`에 남긴다(화면 좌표에서 양수 = 시계 방향).
- 점수: `0.5 + 0.5 × (회전각 여유 + 반지름 균일도)/2`.

### 원 vs 스와이프 충돌 처리

`detectDynamic` 순서: 완성된 원 → 원 진행 중이면(`|Σ Δθ| ≥ circleInProgressAngleDeg` 150°, 반지름 조건 통과) 스와이프 보류 → 스와이프.

반지름이 큰 원의 첫 90° 정도는 기하학적으로 "곡선 스와이프"와 같다(현 2.0 손 크기, 수직 편차 0.19). 회전각만으로는 못 막으므로 **손 모양**으로 구분한다: 원은 검지로 그리고, 스와이프는 펼친 손이나 자연스러운 손으로 한다. 펼친 손으로 큰 원을 그리면 첫 호가 스와이프로 잡힐 수 있다(알려진 한계, 테스트에 기록).

### 검증된 것 / 안 된 것

- 합성 궤적 유닛 테스트: 좌/우 스와이프 방향, 이동량 부족, 느린 이동, 대각선, 왕복, 추적 끊김, 손 크기 불변, 원 1바퀴(양방향), 반 바퀴, 좌우 흔들기 거부, 작은 원, 반지름 들쭉날쭉 거부, 검지 큰 원 중 스와이프 미발동, 포인팅 손 직선 이동은 스와이프 아님.
- **실기 미확인**: 사람 손의 실제 스와이프 속도(2 손 크기를 0.5초 안에 움직이는가), 원을 그릴 때 손목이 함께 도는지 아니면 손가락만 도는지(후자면 검지 끝 반지름이 작아 `circleMinRadius`를 내려야 할 수 있음), 원 그리는 동안 다른 손가락이 정말 접혀 있는지(아니면 `swipeMaxPointingFraction` 규칙이 안 먹음).

## 상태 머신

코드: `src/gesture/stateMachine.ts` (순수 함수 `step`), 합성은 `src/gesture/pipeline.ts`.

| 상태 | 의미 | 나가는 전이 |
|---|---|---|
| `idle` | 후보 없음 | 정적 포즈(점수 통과) → `holding` / 동적 제스처 → `armed` |
| `holding` | 정적 포즈 유지 중. HUD에 진행 링 | 유지 시간 충족 → `armed` / 포즈·손 소실이 `holdGraceMs` 초과 → `idle` + `ignored` / 동적 제스처 감지 → `cancelled` 후 `armed` |
| `armed` | "실행 예정" 표시 | `armDurationMs` 경과 → 실행(`executed` 이벤트) → `cooldown` |
| `cooldown` | `cooldownMs` 동안 모든 후보 무시 | 만료 → `idle`. 마지막 실행 제스처가 계속 보이면 만료 시각을 `t + cooldownMs`로 계속 미룸 |

기획서 7단계 대응: 1 후보 발견=`idle→holding/armed`, 2 유지·궤적=`holding`/`dynamic.ts`, 3 신뢰도=매 틱 `handScore ≥ minHandScore` 및 `poseScore ≥ minPoseScore`, 4 재실행 방지=쿨다운 연장 + release 규칙, 5 실행 예정=`armed`, 6 실행=`executed` 이벤트, 7=`cooldown`.

### 추가 규칙

- **release 규칙**: 정적 제스처(손바닥, 주먹)는 실행 후 그 포즈가 아닌 관측이 한 번은 있어야 다시 후보가 된다. 쿨다운을 0으로 내려도 손바닥을 계속 들고 있는 동안 재생/일시정지가 반복되지 않는다. 위반 시 `ignored:needs_release`.
- **속도 제한**: `holding` 중 손목 속도가 `holdMaxSpeed`(1.5 손 크기/초)를 넘으면 유지 시간이 쌓이지 않는다. 손바닥을 편 채 스와이프할 때 재생 토글이 먼저 발동하는 것을 막는다. 초과 시 `ignored:moving`.
- **동적 우선**: `holding` 중 동적 제스처가 감지되면 유지를 취소(`cancelled`)하고 동적 제스처를 실행한다.
- **fist 예외**: 활성화가 꺼져 있어도 `fist`는 항상 처리된다. 다른 4개는 `ignored:disabled`.
- **궤적 비우기**: 실행 직후 `TrajectoryBuffer.clear()`. 남은 궤적이 다음 틱에 같은 스와이프로 재검출되는 것을 막는다(D-008, 테스트로 고정).
- **로그 중복 방지**: 같은 후보가 계속 보이는 동안 같은 사유의 `ignored`는 한 번만 남는다. 후보가 사라졌다 다시 나타나면 다시 남는다.

### 무시 사유 목록

| 사유 | 뜻 | 튜닝 힌트 |
|---|---|---|
| `hold_too_short` | 유지 시간 전에 포즈가 바뀜 | 자주 나오면 `palmHoldMs`/`fistHoldMs` 감소 또는 `holdGraceMs` 증가 |
| `hand_lost` | 유지 중 손이 사라짐 | 조명·프레임 밖 문제. `minHandDetectionConfidence`(vision) 조정 |
| `moving` | 유지 중 손이 너무 빨리 움직임 | 정지한 손인데도 나오면 `holdMaxSpeed` 증가 |
| `cooldown` | 쿨다운 중 다른 후보 | 의도된 무시. 답답하면 `cooldownMs` 감소 |
| `disabled` | 비활성 상태에서 fist 외 제스처 | 의도된 무시 |
| `low_confidence` | 손 또는 포즈 점수 미달 | `minPoseScore` 감소 또는 `poseSoftMargin` 증가 |
| `needs_release` | 정적 제스처 실행 후 포즈를 풀지 않음 | 의도된 무시 |

### 임계값 (초기값)

| 키 | 값 | 설명 |
|---|---|---|
| `palmHoldMs` | 500 | 손바닥 유지 |
| `fistHoldMs` | 2000 | 주먹 유지 |
| `holdGraceMs` | 150 | 유지 중 끊김 유예 |
| `holdMaxSpeed` | 1.5 | 유지 중 최대 속도 (손 크기/초) |
| `motionWindowMs` | 150 | 속도 계산 창 |
| `armDurationMs` | 200 | 실행 예정 표시 |
| `cooldownMs` | 1500 | 쿨다운 |
| `minHandScore` | 0.6 | 손 신뢰도 하한 |
| `minPoseScore` | 0.6 | 포즈·동적 점수 하한 |

## 알려진 오작동 사례

(실기 테스트 후 채움)

## 튜닝 방법

(8단계에서 채움)

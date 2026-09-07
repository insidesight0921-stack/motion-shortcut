/**
 * 모든 인식 임계값을 한 곳에 모은다.
 * 값은 전부 튜닝 대상 초기값이다. 개발 패널에서 실시간으로 바뀌므로
 * 판정 함수는 이 객체를 매 틱 인자로 받아야 한다(모듈 상수로 캡처하지 말 것).
 *
 * 거리 단위 표기:
 *  - "손 크기 배수": 손목(0)–중지 MCP(9) 거리를 1로 본 단위
 *  - ms: 밀리초
 */
export interface GestureConfig {
  /** HandLandmarker가 준 손 신뢰도(handedness score)의 하한 */
  minHandScore: number;
  /** 자체 정적 포즈 판정 점수의 하한 */
  minPoseScore: number;
  /** 동적 제스처 자체 점수의 하한. 동적 점수는 조건을 통과하면 0.5, 여유가 있을수록 1에 가깝다 */
  minDynamicScore: number;

  /** 손가락 펼침: dist(tip, wrist) / dist(pip, wrist) 가 이 값 이상 */
  fingerExtendRatio: number;
  /** 손가락 접힘: 위 비율이 이 값 이하 (사이 구간은 "애매"로 취급) */
  fingerFoldRatio: number;
  /** 엄지 펼침: dist(4,17) - dist(3,17) 이 이 값(손 크기 배수) 이상 */
  thumbExtendMargin: number;
  /**
   * 포즈 점수 완충 폭. 임계값 딱 걸치면 0.5점, 임계값에서 이 폭만큼 더 확실하면 1점.
   * minPoseScore와 함께 "애매한 포즈"를 걸러내는 데 쓴다.
   */
  poseSoftMargin: number;

  /** 손바닥 펼침 유지 시간 */
  palmHoldMs: number;
  /** 주먹 유지 시간 (활성화 토글) */
  fistHoldMs: number;
  /** 유지 중 포즈가 잠깐 끊겨도 허용하는 시간 */
  holdGraceMs: number;
  /**
   * 정적 포즈 유지 중 허용하는 손목 최대 속도 (손 크기/초).
   * 이보다 빠르면 "지나가는 손"으로 보고 유지 시간을 누적하지 않는다 (손바닥 스와이프가 재생 토글로 잡히는 것 방지).
   */
  holdMaxSpeed: number;
  /** 속도 계산 창 */
  motionWindowMs: number;

  /** "실행 예정" 표시 시간 */
  armDurationMs: number;
  /** 실행 후 쿨다운 */
  cooldownMs: number;

  /** 동적 제스처 창 안에서 프레임 간 간격이 이 값을 넘으면 추적 끊김으로 보고 무효 */
  trackingMaxGapMs: number;

  /** 스와이프 판정 창 */
  swipeWindowMs: number;
  /** 스와이프로 인정하는 최소 지속 시간 (한두 프레임 튐 방지) */
  swipeMinDurationMs: number;
  /** 스와이프 최소 x 이동량 (손 크기 배수) */
  swipeMinDistance: number;
  /** 수평성: max(|net dy|, 직선에서 벗어난 최대 수직 편차) / |dx| 상한 */
  swipeMaxYRatio: number;
  /** 직진성: |net dx| / Σ|Δx| 하한 (왕복하면 낮아짐) */
  swipeMinStraightness: number;
  /**
   * 창 안에서 "검지만 편 손(포인팅)" 프레임 비율이 이 값을 넘으면 스와이프로 보지 않는다.
   * 원은 검지로 그리므로, 큰 원의 첫 호(弧)가 스와이프로 잡히는 것을 손 모양으로 구분한다.
   */
  swipeMaxPointingFraction: number;

  /** 원 판정 창 */
  circleWindowMs: number;
  /** 원 최소 누적 회전각(부호 있는 합의 절댓값), 도 */
  circleMinAngleDeg: number;
  /** 이 각도 이상 회전이 진행 중이면 "원 그리는 중"으로 보고 스와이프 판정을 보류 */
  circleInProgressAngleDeg: number;
  /** 반지름 변동계수(표준편차/평균) 상한 */
  circleMaxRadiusCv: number;
  /** 최소 평균 반지름 (손 크기 배수) */
  circleMinRadius: number;

  /** 궤적 버퍼 보관 시간 */
  trajectoryMs: number;
}

export const DEFAULT_CONFIG: GestureConfig = {
  minHandScore: 0.6,
  minPoseScore: 0.6,
  minDynamicScore: 0.5,

  fingerExtendRatio: 1.05,
  fingerFoldRatio: 0.95,
  thumbExtendMargin: 0.1,
  poseSoftMargin: 0.15,

  palmHoldMs: 500,
  fistHoldMs: 2000,
  holdGraceMs: 150,
  holdMaxSpeed: 1.5,
  motionWindowMs: 150,

  armDurationMs: 200,
  cooldownMs: 1500,

  trackingMaxGapMs: 150,

  swipeWindowMs: 500,
  swipeMinDurationMs: 120,
  swipeMinDistance: 2.0,
  swipeMaxYRatio: 0.35,
  swipeMinStraightness: 0.75,
  swipeMaxPointingFraction: 0.5,

  circleWindowMs: 1500,
  circleMinAngleDeg: 300,
  circleInProgressAngleDeg: 150,
  circleMaxRadiusCv: 0.35,
  circleMinRadius: 0.5,

  trajectoryMs: 1500,
};

/** 개발 패널 슬라이더 범위. key는 GestureConfig의 키. */
export const CONFIG_RANGES: Record<keyof GestureConfig, { min: number; max: number; step: number; label: string }> = {
  minHandScore: { min: 0, max: 1, step: 0.05, label: '손 신뢰도 하한' },
  minPoseScore: { min: 0, max: 1, step: 0.05, label: '포즈 점수 하한' },
  minDynamicScore: { min: 0, max: 1, step: 0.05, label: '동적 점수 하한' },
  fingerExtendRatio: { min: 0.8, max: 1.5, step: 0.01, label: '손가락 펼침 비율' },
  fingerFoldRatio: { min: 0.5, max: 1.2, step: 0.01, label: '손가락 접힘 비율' },
  thumbExtendMargin: { min: 0, max: 0.5, step: 0.01, label: '엄지 펼침 마진' },
  poseSoftMargin: { min: 0.02, max: 0.5, step: 0.01, label: '포즈 점수 완충 폭' },
  palmHoldMs: { min: 100, max: 2000, step: 50, label: '손바닥 유지(ms)' },
  fistHoldMs: { min: 500, max: 4000, step: 100, label: '주먹 유지(ms)' },
  holdGraceMs: { min: 0, max: 500, step: 10, label: '유지 유예(ms)' },
  holdMaxSpeed: { min: 0.2, max: 10, step: 0.1, label: '유지 중 최대 속도(손 크기/초)' },
  motionWindowMs: { min: 50, max: 500, step: 10, label: '속도 계산 창(ms)' },
  armDurationMs: { min: 0, max: 1000, step: 50, label: '실행 예정 표시(ms)' },
  cooldownMs: { min: 0, max: 5000, step: 100, label: '쿨다운(ms)' },
  trackingMaxGapMs: { min: 50, max: 500, step: 10, label: '추적 끊김 허용(ms)' },
  swipeWindowMs: { min: 200, max: 1500, step: 50, label: '스와이프 창(ms)' },
  swipeMinDurationMs: { min: 0, max: 500, step: 10, label: '스와이프 최소 지속(ms)' },
  swipeMinDistance: { min: 0.5, max: 5, step: 0.1, label: '스와이프 최소 이동(손 크기)' },
  swipeMaxYRatio: { min: 0.1, max: 2, step: 0.05, label: '스와이프 수직 편차 상한' },
  swipeMinStraightness: { min: 0.3, max: 1, step: 0.05, label: '스와이프 직진성 하한' },
  swipeMaxPointingFraction: { min: 0, max: 1, step: 0.05, label: '스와이프 중 포인팅 허용 비율' },
  circleWindowMs: { min: 500, max: 3000, step: 100, label: '원 판정 창(ms)' },
  circleMinAngleDeg: { min: 180, max: 720, step: 10, label: '원 최소 회전각(도)' },
  circleInProgressAngleDeg: { min: 60, max: 360, step: 10, label: '원 진행 중 판정각(도)' },
  circleMaxRadiusCv: { min: 0.05, max: 1, step: 0.05, label: '원 반지름 변동 상한' },
  circleMinRadius: { min: 0.1, max: 2, step: 0.05, label: '원 최소 반지름(손 크기)' },
  trajectoryMs: { min: 500, max: 3000, step: 100, label: '궤적 보관(ms)' },
};

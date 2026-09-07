import type { GestureConfig } from './config';
import { handScale, normalizeHand } from './normalize';
import { fingerStates, isPointingPose } from './static';
import { LM, type DynamicResult, type HandFrame, type Point } from './types';

/**
 * 동적 제스처 판정 (스와이프, 원).
 *
 * 입력은 TrajectoryBuffer의 프레임 열(사용자 시점 프레임, 정규화 전 좌표). D-006
 * 좌표계: 사용자 오른쪽 = x 증가. 따라서 dx > 0 이면 swipe_right.
 * 거리는 창 안의 평균 손 크기로 나눠 "손 크기 배수"로 비교한다 (D-005).
 */

/** 구조상 필요한 최소 프레임 수 (튜닝 대상 아님) */
const SWIPE_MIN_FRAMES = 3;
const CIRCLE_MIN_FRAMES = 8;

/** 손바닥 중심: 손목·네 손가락 MCP 평균. 손가락을 접거나 펴도 안정적이다. */
export function palmCenter(lm: Point[]): Point {
  const idx = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];
  let x = 0;
  let y = 0;
  for (const i of idx) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / idx.length, y: y / idx.length };
}

/** now 기준 최근 windowMs 프레임. 추적이 끊겼으면(간격 > maxGapMs) null. */
function recentContinuous(frames: HandFrame[], now: number, windowMs: number, maxGapMs: number): HandFrame[] | null {
  const from = now - windowMs;
  let start = 0;
  while (start < frames.length && frames[start].t < from) start++;
  const win = frames.slice(start);
  for (let i = 1; i < win.length; i++) {
    if (win[i].t - win[i - 1].t > maxGapMs) return null;
  }
  // 마지막 프레임이 너무 오래됐으면(손이 사라짐) 무효
  if (win.length > 0 && now - win[win.length - 1].t > maxGapMs) return null;
  return win;
}

function meanScale(win: HandFrame[]): number {
  let s = 0;
  for (const f of win) s += handScale(f.landmarks);
  return s / win.length;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 궤적의 중심 기준 **부호 있는** 누적 회전각(도).
 * 왕복 운동은 +와 −가 상쇄되어 0 근처가 되고, 원은 ±360 근처가 된다 (D-008).
 * 화면 좌표(y 아래가 +)에서 양수는 시계 방향으로 보인다.
 */
export function signedRotationDeg(points: Point[], center: Point): number {
  let sum = 0;
  let prev = Math.atan2(points[0].y - center.y, points[0].x - center.x);
  for (let i = 1; i < points.length; i++) {
    const a = Math.atan2(points[i].y - center.y, points[i].x - center.x);
    let d = a - prev;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    sum += d;
    prev = a;
  }
  return (sum * 180) / Math.PI;
}

/** 부호 없는 누적 회전각(도). 비교·디버그용. 판정에는 쓰지 않는다. */
export function absRotationDeg(points: Point[], center: Point): number {
  let sum = 0;
  let prev = Math.atan2(points[0].y - center.y, points[0].x - center.x);
  for (let i = 1; i < points.length; i++) {
    const a = Math.atan2(points[i].y - center.y, points[i].x - center.x);
    let d = a - prev;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    sum += Math.abs(d);
    prev = a;
  }
  return (sum * 180) / Math.PI;
}

export interface CircleAnalysis {
  /** 부호 있는 누적 회전각(도) */
  totalAngleDeg: number;
  /** 평균 반지름 (손 크기 배수) */
  meanRadius: number;
  /** 반지름 변동계수 */
  radiusCv: number;
  /** 궤적 x 범위 / y 범위. 정원은 1 근처, 납작한 고리는 크게 벗어난다 (T-008) */
  aspect: number;
  /** 창 안에서 검지가 펼침 상태인 프레임 비율 (T-007) */
  indexExtendedFraction: number;
  frames: number;
}

/** 창 안에서 검지가 펼쳐진 프레임 비율 */
export function indexExtendedFraction(win: HandFrame[], cfg: GestureConfig): number {
  if (win.length === 0) return 0;
  let n = 0;
  for (const f of win) if (fingerStates(normalizeHand(f.landmarks).points, cfg).index) n++;
  return n / win.length;
}

/** 원 판정에 쓰는 수치만 계산한다 (판정은 detectCircle). */
export function analyzeCircle(frames: HandFrame[], now: number, cfg: GestureConfig): CircleAnalysis | null {
  const win = recentContinuous(frames, now, cfg.circleWindowMs, cfg.trackingMaxGapMs);
  if (!win || win.length < CIRCLE_MIN_FRAMES) return null;
  const scale = meanScale(win);
  if (scale < 1e-6) return null;
  const pts = win.map((f) => f.landmarks[LM.INDEX_TIP]);
  const center = { x: 0, y: 0 };
  for (const p of pts) {
    center.x += p.x;
    center.y += p.y;
  }
  center.x /= pts.length;
  center.y /= pts.length;

  const radii = pts.map((p) => Math.hypot(p.x - center.x, p.y - center.y) / scale);
  const meanRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
  const idxFrac = indexExtendedFraction(win, cfg);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const rangeY = maxY - minY;
  const aspect = rangeY > 1e-9 ? (maxX - minX) / rangeY : Infinity;

  if (meanRadius < 1e-6) {
    return { totalAngleDeg: 0, meanRadius: 0, radiusCv: 0, aspect, indexExtendedFraction: idxFrac, frames: win.length };
  }
  const variance = radii.reduce((a, r) => a + (r - meanRadius) ** 2, 0) / radii.length;
  const radiusCv = Math.sqrt(variance) / meanRadius;
  return { totalAngleDeg: signedRotationDeg(pts, center), meanRadius, radiusCv, aspect, indexExtendedFraction: idxFrac, frames: win.length };
}

/** 검지 펼침 게이트 (circleMinIndexExtendedFraction = 0 이면 항상 통과) */
function indexGateOk(a: CircleAnalysis, cfg: GestureConfig): boolean {
  return cfg.circleMinIndexExtendedFraction <= 0 || a.indexExtendedFraction >= cfg.circleMinIndexExtendedFraction;
}

/**
 * 원: 검지 끝(8) 궤적의 중심 기준 부호 있는 누적 회전각이 circleMinAngleDeg 이상이고,
 * 반지름이 충분히 크며(circleMinRadius), 반지름 변동이 작고(circleMaxRadiusCv),
 * 가로/세로 비율이 원에 가깝고(circleMinAspect~circleMaxAspect, T-008),
 * 창 대부분에서 검지가 펼쳐져 있을 것(circleMinIndexExtendedFraction, T-007).
 */
export function detectCircle(frames: HandFrame[], now: number, cfg: GestureConfig): DynamicResult | null {
  const a = analyzeCircle(frames, now, cfg);
  if (!a) return null;
  const angle = Math.abs(a.totalAngleDeg);
  if (angle < cfg.circleMinAngleDeg) return null;
  if (a.meanRadius < cfg.circleMinRadius) return null;
  if (a.radiusCv > cfg.circleMaxRadiusCv) return null;
  if (a.aspect < cfg.circleMinAspect || a.aspect > cfg.circleMaxAspect) return null;
  if (!indexGateOk(a, cfg)) return null;

  const angleQ = clamp01((angle - cfg.circleMinAngleDeg) / 60);
  const radiusQ = 1 - a.radiusCv / cfg.circleMaxRadiusCv;
  const quality = 0.5 * angleQ + 0.5 * radiusQ;
  return {
    gesture: 'circle',
    score: 0.5 + 0.5 * quality,
    detail: {
      totalAngleDeg: a.totalAngleDeg,
      meanRadius: a.meanRadius,
      radiusCv: a.radiusCv,
      aspect: a.aspect,
      indexExtendedFraction: a.indexExtendedFraction,
      direction: Math.sign(a.totalAngleDeg),
      frames: a.frames,
    },
  };
}

/**
 * 스와이프: 최근 swipeWindowMs 동안 손바닥 중심의 x 이동량이 swipeMinDistance(손 크기 배수) 이상,
 * 수직 편차가 작고(swipeMaxYRatio), 왕복하지 않을 것(swipeMinStraightness).
 * 방향: dx > 0 → swipe_right (사용자 오른쪽), dx < 0 → swipe_left.
 */
export function detectSwipe(frames: HandFrame[], now: number, cfg: GestureConfig): DynamicResult | null {
  const win = recentContinuous(frames, now, cfg.swipeWindowMs, cfg.trackingMaxGapMs);
  if (!win || win.length < SWIPE_MIN_FRAMES) return null;
  const durationMs = win[win.length - 1].t - win[0].t;
  if (durationMs < cfg.swipeMinDurationMs) return null;
  const scale = meanScale(win);
  if (scale < 1e-6) return null;

  const pts = win.map((f) => palmCenter(f.landmarks));
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dx = (last.x - first.x) / scale;
  const dy = (last.y - first.y) / scale;
  const absDx = Math.abs(dx);
  if (absDx < cfg.swipeMinDistance) return null;

  // 직진성: 순 이동 / 경로 길이(x)
  let pathX = 0;
  for (let i = 1; i < pts.length; i++) pathX += Math.abs(pts[i].x - pts[i - 1].x) / scale;
  const straightness = pathX > 0 ? absDx / pathX : 0;
  if (straightness < cfg.swipeMinStraightness) return null;

  // 수직 편차: 순 dy와, 시작–끝 직선에서 벗어난 최대 수직 거리 중 큰 값
  let maxDev = 0;
  for (const p of pts) {
    // 직선 first→last 에 대한 점 p의 수직 거리 (손 크기 배수)
    const vx = last.x - first.x;
    const vy = last.y - first.y;
    const len = Math.hypot(vx, vy);
    const dev = len > 0 ? Math.abs((p.x - first.x) * vy - (p.y - first.y) * vx) / len / scale : 0;
    if (dev > maxDev) maxDev = dev;
  }
  const yRatio = Math.max(Math.abs(dy), maxDev) / absDx;
  if (yRatio > cfg.swipeMaxYRatio) return null;

  // 손 모양: 검지만 편 손(원 그리는 손)이 대부분이면 스와이프가 아니다
  let pointing = 0;
  for (const f of win) if (isPointingPose(normalizeHand(f.landmarks).points, cfg)) pointing++;
  const pointingFraction = pointing / win.length;
  if (pointingFraction > cfg.swipeMaxPointingFraction) return null;

  const distQ = clamp01((absDx - cfg.swipeMinDistance) / cfg.swipeMinDistance);
  const lineQ = 1 - yRatio / cfg.swipeMaxYRatio;
  const straightQ = clamp01((straightness - cfg.swipeMinStraightness) / (1 - cfg.swipeMinStraightness));
  const quality = (distQ + lineQ + straightQ) / 3;
  return {
    gesture: dx > 0 ? 'swipe_right' : 'swipe_left',
    score: 0.5 + 0.5 * quality,
    detail: { dx, dy, straightness, yRatio, pointingFraction, durationMs, frames: win.length },
  };
}

/**
 * 동적 제스처 통합 판정.
 * 순서: 원 → (원 진행 중이면 스와이프 보류) → 스와이프.
 * 큰 원의 호(弧)가 수평 이동처럼 보여 스와이프로 잡히는 것을 두 겹으로 막는다:
 *  1) 회전이 circleInProgressAngleDeg 이상 진행됐으면 스와이프 보류
 *  2) detectSwipe 안에서 포인팅 손 모양이면 거부 (원은 검지로 그린다)
 * 반지름이 큰 원의 첫 90° 정도는 기하학적으로 곡선 스와이프와 같아서 1)만으로는 못 막고 2)가 필요하다.
 */
export function detectDynamic(frames: HandFrame[], now: number, cfg: GestureConfig): DynamicResult | null {
  const circle = detectCircle(frames, now, cfg);
  if (circle) return circle;

  // 진행 중 판정에는 가로/세로 비율을 적용하지 않는다(반원은 본래 2:1). 검지 게이트는 적용해
  // 주먹이 흔들리는 동안 스와이프까지 막히지 않게 한다.
  const a = analyzeCircle(frames, now, cfg);
  const circleInProgress =
    a !== null &&
    Math.abs(a.totalAngleDeg) >= cfg.circleInProgressAngleDeg &&
    a.meanRadius >= cfg.circleMinRadius &&
    a.radiusCv <= cfg.circleMaxRadiusCv &&
    indexGateOk(a, cfg);
  if (circleInProgress) return null;

  return detectSwipe(frames, now, cfg);
}

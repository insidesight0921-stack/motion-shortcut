import type { GestureConfig } from './config';
import { dist, handScale, normalizeHand } from './normalize';
import { isPointingPose } from './static';
import { LM, type HandFrame, type Point } from './types';

/**
 * 양손 포즈 판정 (추가 모듈, D-017). 한 손 파이프라인(static/dynamic/stateMachine)은 건드리지 않는다.
 * 좌표계는 사용자 시점: x 가 작을수록 사용자의 왼쪽.
 *
 *  x_cross     양손으로 X: 두 손의 손목→중지 끝 선분이 교차하고, 방향 벡터 사이 각도가 [crossAngleMin, Max],
 *              손목 간 거리가 crossMaxWristDistance(손 크기 배수) 이하. 손가락 모양은 묻지 않는다 (§13 모션 잠금).
 *  index_cross 양손 검지 교차: 두 손 모두 포인팅 + 검지 선분(5→8)이 교차 + 같은 각도 조건 (§12 모드 진입, 2차).
 */
export interface TwoHandFrame {
  t: number;
  left: HandFrame;
  right: HandFrame;
}

export type TwoHandPose = 'x_cross' | 'index_cross';

export interface TwoHandPoseResult {
  pose: TwoHandPose | null;
  /** 0~1. 조건 통과 시 0.5 이상 */
  score: number;
  detail: Record<string, number>;
}

/**
 * 손 두 개를 왼/오른으로 짝짓는다. hand 라벨이 있으면 그것을 쓰고, 없거나 겹치면 손목 x 로 정한다.
 * 손이 2개가 아니면 null.
 */
export function pairHands(hands: HandFrame[]): TwoHandFrame | null {
  if (hands.length !== 2) return null;
  const [a, b] = hands;
  let left: HandFrame;
  let right: HandFrame;
  if (a.hand && b.hand && a.hand !== b.hand) {
    left = a.hand === 'left' ? a : b;
    right = a.hand === 'left' ? b : a;
  } else {
    // 라벨을 못 믿을 때: 사용자 시점에서 x 가 작은 쪽이 왼손
    const ax = a.landmarks[LM.WRIST].x;
    const bx = b.landmarks[LM.WRIST].x;
    left = ax <= bx ? a : b;
    right = ax <= bx ? b : a;
  }
  return { t: Math.max(a.t, b.t), left, right };
}

/** 두 손목의 중점 (모드 진입 뒤 방향 판정 기준점) */
export function twoHandCenter(f: TwoHandFrame): Point {
  const l = f.left.landmarks[LM.WRIST];
  const r = f.right.landmarks[LM.WRIST];
  return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** 선분 p1p2 와 p3p4 가 교차하는가 (끝점 접촉 포함). 교차하면 p1p2 상의 위치 비율(0~1)도 돌려준다 */
export function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): { hit: boolean; tOnFirst: number } {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  const hit = ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  if (!hit) return { hit: false, tOnFirst: 0 };
  // 교차점의 p1→p2 비율
  const denom = d1 - d2;
  const tOnFirst = denom !== 0 ? d1 / denom : 0.5;
  return { hit: true, tOnFirst };
}

/** 두 벡터 사이 각도 (도, 0~180) */
export function angleBetweenDeg(a: Point, b: Point): number {
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const c = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)));
  return (Math.acos(c) * 180) / Math.PI;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

interface CrossCheck {
  ok: boolean;
  angleDeg: number;
  wristDist: number;
  tOnFirst: number;
}

function checkCross(f: TwoHandFrame, from: number, to: number, cfg: GestureConfig): CrossCheck {
  const L = f.left.landmarks;
  const R = f.right.landmarks;
  const scale = (handScale(L) + handScale(R)) / 2 || 1e-6;
  const wristDist = dist(L[LM.WRIST], R[LM.WRIST]) / scale;
  const vl = { x: L[to].x - L[from].x, y: L[to].y - L[from].y };
  const vr = { x: R[to].x - R[from].x, y: R[to].y - R[from].y };
  const angleDeg = angleBetweenDeg(vl, vr);
  const inter = segmentsIntersect(L[from], L[to], R[from], R[to]);
  const ok = inter.hit && angleDeg >= cfg.crossAngleMinDeg && angleDeg <= cfg.crossAngleMaxDeg && wristDist <= cfg.crossMaxWristDistance;
  return { ok, angleDeg, wristDist, tOnFirst: inter.tOnFirst };
}

function crossQuality(c: CrossCheck, cfg: GestureConfig): number {
  // 90° 에 가까울수록, 교차점이 선분 가운데(0.5)에 가까울수록 확실
  const mid = (cfg.crossAngleMinDeg + cfg.crossAngleMaxDeg) / 2;
  const half = (cfg.crossAngleMaxDeg - cfg.crossAngleMinDeg) / 2 || 1;
  const angleQ = 1 - clamp01(Math.abs(c.angleDeg - mid) / half);
  const posQ = 1 - clamp01(Math.abs(c.tOnFirst - 0.5) / 0.5);
  return 0.6 * angleQ + 0.4 * posQ;
}

export function classifyTwoHandPose(f: TwoHandFrame, cfg: GestureConfig): TwoHandPoseResult {
  // 검지 교차가 더 구체적이므로 먼저 본다
  const lPointing = isPointingPose(normalizeHand(f.left.landmarks).points, cfg);
  const rPointing = isPointingPose(normalizeHand(f.right.landmarks).points, cfg);
  if (lPointing && rPointing) {
    const idx = checkCross(f, LM.INDEX_MCP, LM.INDEX_TIP, cfg);
    if (idx.ok) {
      return { pose: 'index_cross', score: 0.5 + 0.5 * crossQuality(idx, cfg), detail: { angleDeg: idx.angleDeg, wristDist: idx.wristDist, tOnFirst: idx.tOnFirst } };
    }
  }
  const x = checkCross(f, LM.WRIST, LM.MIDDLE_TIP, cfg);
  if (x.ok) {
    return { pose: 'x_cross', score: 0.5 + 0.5 * crossQuality(x, cfg), detail: { angleDeg: x.angleDeg, wristDist: x.wristDist, tOnFirst: x.tOnFirst } };
  }
  return { pose: null, score: 0, detail: { angleDeg: x.angleDeg, wristDist: x.wristDist } };
}

/** 한 손 파이프라인에 넣을 주 손: 설정된 손이 있으면 그 손, 없으면 첫 손 */
export function pickPrimaryHand(hands: HandFrame[], activeHand: 'left' | 'right'): HandFrame | null {
  return hands.find((h) => h.hand === activeHand) ?? hands[0] ?? null;
}

import type { GestureConfig } from './config';
import { dist } from './normalize';
import { LM, type Point, type StaticPose } from './types';

export type FingerName = 'index' | 'middle' | 'ring' | 'pinky';

const FINGERS: Record<FingerName, { tip: number; pip: number }> = {
  index: { tip: LM.INDEX_TIP, pip: LM.INDEX_PIP },
  middle: { tip: LM.MIDDLE_TIP, pip: LM.MIDDLE_PIP },
  ring: { tip: LM.RING_TIP, pip: LM.RING_PIP },
  pinky: { tip: LM.PINKY_TIP, pip: LM.PINKY_PIP },
};

export interface FingerStates {
  /** 엄지: 손 방향 무관 거리 규칙 (D-004) */
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
  /** 손가락별 dist(tip, wrist) / dist(pip, wrist) */
  ratios: Record<FingerName, number>;
  /** dist(4,17) - dist(3,17), 손 크기 배수 */
  thumbMargin: number;
}

export interface StaticPoseResult {
  pose: StaticPose | null;
  /** 0~1. 임계값에 딱 걸치면 0.5, poseSoftMargin만큼 여유 있으면 1 */
  score: number;
  fingers: FingerStates;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 손가락 펼침 비율. 끝이 PIP보다 손목에서 멀면(>1) 펼침, 가까우면(<1) 접힘.
 * 정규화 좌표를 넣는다(손목이 원점이므로 dist(p, wrist) = |p|).
 */
export function fingerRatio(norm: Point[], finger: FingerName): number {
  const wrist = norm[LM.WRIST];
  const { tip, pip } = FINGERS[finger];
  const pipDist = dist(norm[pip], wrist);
  return pipDist > 1e-6 ? dist(norm[tip], wrist) / pipDist : 0;
}

/** 엄지 마진: 끝(4)이 IP(3)보다 새끼 MCP(17)에서 얼마나 더 먼가 */
export function thumbMargin(norm: Point[]): number {
  const pinkyMcp = norm[LM.PINKY_MCP];
  return dist(norm[LM.THUMB_TIP], pinkyMcp) - dist(norm[LM.THUMB_IP], pinkyMcp);
}

export function fingerStates(norm: Point[], cfg: GestureConfig): FingerStates {
  const ratios = {
    index: fingerRatio(norm, 'index'),
    middle: fingerRatio(norm, 'middle'),
    ring: fingerRatio(norm, 'ring'),
    pinky: fingerRatio(norm, 'pinky'),
  };
  const tm = thumbMargin(norm);
  return {
    thumb: tm >= cfg.thumbExtendMargin,
    index: ratios.index >= cfg.fingerExtendRatio,
    middle: ratios.middle >= cfg.fingerExtendRatio,
    ring: ratios.ring >= cfg.fingerExtendRatio,
    pinky: ratios.pinky >= cfg.fingerExtendRatio,
    ratios,
    thumbMargin: tm,
  };
}

/**
 * 포인팅(검지만 펼침, 중지·약지·새끼 접힘). 명령에 매핑된 포즈는 아니고,
 * "원 그리는 손"과 "스와이프하는 손"을 구분하는 데 쓴다. 엄지는 무관.
 */
export function isPointingPose(norm: Point[], cfg: GestureConfig): boolean {
  const f = fingerStates(norm, cfg);
  return (
    f.index &&
    f.ratios.middle <= cfg.fingerFoldRatio &&
    f.ratios.ring <= cfg.fingerFoldRatio &&
    f.ratios.pinky <= cfg.fingerFoldRatio
  );
}

/**
 * 정적 포즈 판정.
 *  - open_palm: 엄지 포함 5개 모두 펼침
 *  - fist: 엄지 제외 4개 모두 접힘 (ratio <= fingerFoldRatio). 엄지는 어디 있든 무관
 *  - 그 외: null
 * 점수는 가장 약한 손가락 기준(min)이다. 하나라도 애매하면 점수가 낮아진다.
 */
export function classifyStaticPose(norm: Point[], cfg: GestureConfig): StaticPoseResult {
  const fingers = fingerStates(norm, cfg);
  const soft = cfg.poseSoftMargin;
  const names: FingerName[] = ['index', 'middle', 'ring', 'pinky'];

  const allExtended = names.every((n) => fingers[n]) && fingers.thumb;
  if (allExtended) {
    const confs = names.map((n) => clamp01(0.5 + (fingers.ratios[n] - cfg.fingerExtendRatio) / (2 * soft)));
    confs.push(clamp01(0.5 + (fingers.thumbMargin - cfg.thumbExtendMargin) / (2 * soft)));
    return { pose: 'open_palm', score: Math.min(...confs), fingers };
  }

  const allFolded = names.every((n) => fingers.ratios[n] <= cfg.fingerFoldRatio);
  if (allFolded) {
    const confs = names.map((n) => clamp01(0.5 + (cfg.fingerFoldRatio - fingers.ratios[n]) / (2 * soft)));
    return { pose: 'fist', score: Math.min(...confs), fingers };
  }

  return { pose: null, score: 0, fingers };
}

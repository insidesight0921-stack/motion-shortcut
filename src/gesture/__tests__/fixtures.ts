import { LANDMARK_COUNT, LM, type Point } from '../types';

/**
 * 합성 손 좌표 생성기. 카메라 없이 판정 로직을 테스트하기 위한 것.
 *
 * 기본 자세: 사용자 시점 프레임(0~1), 손목이 (0.5, 0.8), 손가락이 위(y 감소)를 향한 오른손.
 * 손 크기(손목–중지 MCP)는 0.2.
 * 좌표는 실제 랜드마크와 비슷한 비율로 손으로 잡은 값이며, 정확한 해부학 모델은 아니다.
 */
export type FingerPose = 'extended' | 'folded';

export interface HandSpec {
  thumb?: FingerPose;
  index?: FingerPose;
  middle?: FingerPose;
  ring?: FingerPose;
  pinky?: FingerPose;
}

const WRIST: Point = { x: 0.5, y: 0.8 };

// 손가락별 MCP 위치 (약간 부채꼴)
const MCP: Record<'index' | 'middle' | 'ring' | 'pinky', Point> = {
  index: { x: 0.44, y: 0.61 },
  middle: { x: 0.5, y: 0.6 },
  ring: { x: 0.56, y: 0.61 },
  pinky: { x: 0.62, y: 0.63 },
};

function finger(mcp: Point, pose: FingerPose): [Point, Point, Point, Point] {
  if (pose === 'extended') {
    return [
      mcp,
      { x: mcp.x, y: mcp.y - 0.06 }, // PIP
      { x: mcp.x, y: mcp.y - 0.11 }, // DIP
      { x: mcp.x, y: mcp.y - 0.15 }, // TIP
    ];
  }
  // 접힘: 끝이 손바닥 쪽으로 말려 들어와 MCP 근처(살짝 아래)로 온다
  return [
    mcp,
    { x: mcp.x, y: mcp.y - 0.05 }, // PIP
    { x: mcp.x + 0.01, y: mcp.y - 0.02 }, // DIP
    { x: mcp.x + 0.01, y: mcp.y + 0.02 }, // TIP
  ];
}

function thumb(pose: FingerPose): [Point, Point, Point, Point] {
  const cmc: Point = { x: 0.44, y: 0.75 };
  const mcp: Point = { x: 0.38, y: 0.7 };
  if (pose === 'extended') {
    return [cmc, mcp, { x: 0.34, y: 0.64 }, { x: 0.3, y: 0.58 }];
  }
  // 접힘: 손바닥을 가로질러 새끼 쪽으로
  return [cmc, mcp, { x: 0.42, y: 0.66 }, { x: 0.48, y: 0.66 }];
}

export function makeHand(spec: HandSpec = {}): Point[] {
  const pts: Point[] = new Array(LANDMARK_COUNT);
  pts[LM.WRIST] = { ...WRIST };
  const [t1, t2, t3, t4] = thumb(spec.thumb ?? 'extended');
  pts[LM.THUMB_CMC] = t1;
  pts[LM.THUMB_MCP] = t2;
  pts[LM.THUMB_IP] = t3;
  pts[LM.THUMB_TIP] = t4;

  const assign = (base: number, pts4: [Point, Point, Point, Point]) => {
    pts[base] = pts4[0];
    pts[base + 1] = pts4[1];
    pts[base + 2] = pts4[2];
    pts[base + 3] = pts4[3];
  };
  assign(LM.INDEX_MCP, finger(MCP.index, spec.index ?? 'extended'));
  assign(LM.MIDDLE_MCP, finger(MCP.middle, spec.middle ?? 'extended'));
  assign(LM.RING_MCP, finger(MCP.ring, spec.ring ?? 'extended'));
  assign(LM.PINKY_MCP, finger(MCP.pinky, spec.pinky ?? 'extended'));
  return pts.map((p) => ({ ...p }));
}

export const openHand = (): Point[] => makeHand();
export const fistHand = (): Point[] =>
  makeHand({ thumb: 'folded', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' });
export const pointingHand = (): Point[] =>
  makeHand({ thumb: 'folded', index: 'extended', middle: 'folded', ring: 'folded', pinky: 'folded' });

/** 평행이동 + 배율 (배율은 손목 기준) */
export function transformHand(pts: Point[], opts: { dx?: number; dy?: number; scale?: number }): Point[] {
  const { dx = 0, dy = 0, scale = 1 } = opts;
  const w = pts[LM.WRIST];
  return pts.map((p) => ({
    x: w.x + (p.x - w.x) * scale + dx,
    y: w.y + (p.y - w.y) * scale + dy,
    z: p.z,
  }));
}

/** 손목 기준 회전 (라디안, 화면 좌표계라 y 아래가 +) */
export function rotateHand(pts: Point[], rad: number): Point[] {
  const w = pts[LM.WRIST];
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return pts.map((p) => {
    const x = p.x - w.x;
    const y = p.y - w.y;
    return { x: w.x + x * c - y * s, y: w.y + x * s + y * c, z: p.z };
  });
}

/** 좌우 반전 (왼손 모양 만들기). 손목 x 기준으로 뒤집는다. */
export function mirrorHand(pts: Point[]): Point[] {
  const w = pts[LM.WRIST];
  return pts.map((p) => ({ x: w.x - (p.x - w.x), y: p.y, z: p.z }));
}

/** 손 전체를 dx, dy 만큼 옮긴 프레임 열 생성 (동적 제스처 테스트용) */
export function translateHand(pts: Point[], dx: number, dy: number): Point[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z }));
}

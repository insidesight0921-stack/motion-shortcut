import { describe, expect, it } from "vitest";
import { blockPalmAfterSwipe, detectSwipeGesture } from "./useHandTracking";

type Point = { x: number; y: number };

function openHand(wristX: number) {
  const points: Point[] = Array.from({ length: 21 }, () => ({
    x: wristX,
    y: 0.5,
  }));
  points[0] = { x: wristX, y: 0.8 };
  points[9] = { x: wristX, y: 0.55 };
  for (const [pip, tip] of [
    [6, 8],
    [10, 12],
    [14, 16],
    [18, 20],
  ]) {
    points[pip] = { x: wristX, y: 0.45 };
    points[tip] = { x: wristX, y: 0.18 };
  }
  return points;
}

describe("슬라이드 스와이프", () => {
  it.each([
    ["오른쪽", [0.63, 0.59, 0.55, 0.51], "swipe-right"],
    ["왼쪽", [0.37, 0.41, 0.45, 0.49], "swipe-left"],
  ])("손바닥을 %s으로 이동하면 해당 스와이프로 분류한다", (_, xs, expected) => {
    const histories = { Left: [], Right: [] } as Record<
      "Left" | "Right",
      Array<{ x: number; y: number; at: number }>
    >;
    const cooldown = { current: 0 };
    let result = null;
    xs.forEach((x, index) => {
      result = detectSwipeGesture(
        [{ landmarks: openHand(x), handedness: "Right" }],
        index * 80,
        histories,
        cooldown,
      );
    });
    expect(result).toBe(expected);
  });
});

describe("스와이프 후 손바닥 재무장", () => {
  it("시간이 지나도 손바닥을 유지하면 차단하고 다른 자세나 손 내리기로 해제한다", () => {
    const state = { current: false };
    expect(blockPalmAfterSwipe(state, true, true)).toBe(true);
    for (let i = 0; i < 100; i++) expect(blockPalmAfterSwipe(state, false, true)).toBe(true);
    expect(blockPalmAfterSwipe(state, false, false)).toBe(false);
    expect(blockPalmAfterSwipe(state, false, true)).toBe(false);
    expect(blockPalmAfterSwipe(state, true, false)).toBe(true);
    expect(blockPalmAfterSwipe(state, false, false)).toBe(false);
  });
});

// Synthetic landmarks exercise geometry independently of camera/model availability.
function pose(raised: number[] = [], thumb = false) {
  const points = Array.from({ length: 21 }, () => ({ x: .5, y: .65 }));
  points[0] = { x: .5, y: .9 };
  points[9] = { x: .5, y: .6 };
  points[5] = { x: .42, y: .6 };
  points[2] = { x: .4, y: .72 };
  points[3] = { x: .4, y: .64 };
  points[4] = thumb ? { x: .22, y: .55 } : { x: .46, y: .65 };
  for (const [i, tip] of [8, 12, 16, 20].entries()) {
    points[tip - 2] = { x: .4 + i * .07, y: .48 };
    points[tip] = { x: .4 + i * .07, y: raised.includes(tip) ? .25 : .7 };
  }
  return points;
}

import { classifyGesture, detectModeGesture, resolveGesture } from "./useHandTracking";

describe("custom hand poses", () => {
  it.each([[-1, "thumbs-up"], [1, "thumbs-down"]] as const)("recognizes thumb direction %s without treating it as a fist", (direction, expected) => {
    const hand = pose([], true);
    hand[4] = { x: .4, y: .72 + direction * .5 };
    expect(classifyGesture(hand)).toBe(expected);
    expect(detectModeGesture([hand])).toBeNull();
    expect(classifyGesture(pose())).toBe("fist");
  });
  it("distinguishes OK from an open palm", () => {
    const hand = pose([12, 16, 20]);
    hand[8] = { x: .42, y: .6 };
    hand[4] = { x: .43, y: .6 };
    expect(classifyGesture(hand)).toBe("ok");
    expect(detectModeGesture([hand])).toBeNull();
    expect(classifyGesture(pose([8, 12, 16, 20]))).toBe("open-palm");
  });
  it("gives assigned three-finger poses priority over pointer mode, while retaining the slide mode pose", () => {
    const hand = pose([8, 20], true);
    expect(classifyGesture(hand)).toBe("three-fingers");
    expect(detectModeGesture([hand])).toBe("laser");
    expect(detectModeGesture([hand], ["three-fingers"])).toBeNull();
    expect(detectModeGesture([pose([8, 12, 16])], ["three-fingers"])).toBe("slide");
    expect(classifyGesture(pose([20], true))).toBe("toggle-motion");
  });
  it.each([
    ["point-left", { x: .85, y: .48 }],
    ["point-right", { x: -.05, y: .48 }],
    ["point-up", { x: .4, y: .2 }],
  ] as const)("recognizes mirrored %s and preserves unassigned index behavior", (expected, tip) => {
    const hand = pose([8]);
    hand[8] = tip;
    expect(classifyGesture(hand)).toBe(expected);
    expect(resolveGesture(hand, [expected])).toBe(expected);
    expect(resolveGesture(hand, [])).toBe("index");
    expect(detectModeGesture([hand])).toBeNull();
    const mirrored = hand.map(p => ({ x: 1 - p.x, y: p.y }));
    expect(classifyGesture(mirrored)).toBe(expected === "point-left" ? "point-right" : expected === "point-right" ? "point-left" : expected);
  });
  it("keeps ambiguous diagonal pointing as index", () => {
    const hand = pose([8]);
    hand[8] = { x: .15, y: .23 };
    expect(classifyGesture(hand)).toBe("index");
  });
});

describe("slide mode return with two hands", () => {
  it.each([false, true])("prioritizes slide return over a held L pose (reversed: %s)", (reverse) => {
    const pointer = pose([8], true);
    const slide = pose([8, 12, 16]);
    expect(detectModeGesture([pointer])).toBe("cursor");
    const hands = reverse ? [slide, pointer] : [pointer, slide];
    expect(detectModeGesture(hands)).toBe("slide");
    expect(detectModeGesture(hands, ["three-fingers", "point-up"])).toBe("slide");
  });
  it("prioritizes slide return over the alternate pointer pose", () => {
    expect(detectModeGesture([pose([8, 20], true), pose([8, 12, 16])])).toBe("slide");
  });
});

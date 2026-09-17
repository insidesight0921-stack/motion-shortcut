import { describe, expect, it } from "vitest";
import { detectSwipeGesture } from "./useHandTracking";

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

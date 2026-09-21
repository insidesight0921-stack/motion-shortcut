import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ShortcutSettings } from "./ShortcutSettings";
import { usePresentationController } from "../features/presentation/usePresentationController";
import { loadProfile } from "../features/presentation/profile";
vi.mock("../features/camera/useHandTracking", () => ({ useHandTracking: () => ({ state: "idle", errorMessage: "" }) }));
beforeEach(() => { localStorage.clear(); delete window.motionAPI; });
function Settings() { return <ShortcutSettings controller={usePresentationController()} />; }
it("blocks used and reserved motions, and allows reassignment after releasing a motion", async () => {
  const user = userEvent.setup();
  render(<Settings />);
  const next = screen.getByRole("combobox", { name: "다음 슬라이드 모션 선택" });
  const previous = screen.getByRole("combobox", { name: "이전 슬라이드 모션 선택" });
  expect(within(previous).getByRole("option", { name: /오른쪽 스와이프/ })).toBeDisabled();
  expect(within(next).getByRole("option", { name: /V 사인/ })).toBeDisabled();
  expect(within(next).getByRole("option", { name: /검지 하나/ })).toBeDisabled();
  await user.selectOptions(previous, "swipe-right");
  expect(previous).toHaveValue("swipe-left");
  await user.selectOptions(next, "");
  expect(within(previous).getByRole("option", { name: /오른쪽 스와이프/ })).toBeEnabled();
  await user.selectOptions(previous, "swipe-right");
  expect(previous).toHaveValue("swipe-right");
  expect(within(next).getByRole("option", { name: /오른쪽 스와이프/ })).toBeDisabled();
  expect(loadProfile().mappings).toMatchObject({ "next-slide": "", "previous-slide": "swipe-right" });
});
it("resets each input type independently and persists defaults", async () => {
  const user = userEvent.setup();
  render(<Settings />);
  const next = screen.getByRole("combobox", { name: "다음 슬라이드 모션 선택" });
  const previous = screen.getByRole("combobox", { name: "이전 슬라이드 모션 선택" });
  await user.selectOptions(next, "");
  await user.selectOptions(previous, "swipe-right");
  await user.selectOptions(next, "swipe-left");
  await user.click(screen.getByRole("button", { name: "다음 슬라이드 키 지정" }));
  await user.keyboard("n");
  const saved = loadProfile();
  await user.click(screen.getByRole("button", { name: "모션 전체 초기화" }));
  expect(next).toHaveValue("swipe-right");
  expect(previous).toHaveValue("swipe-left");
  expect(loadProfile().shortcuts).toEqual(saved.shortcuts);
  expect(loadProfile().resources).toEqual(saved.resources);
  await user.selectOptions(next, "");
  const mappings = loadProfile().mappings;
  await user.click(screen.getByRole("button", { name: "키보드 전체 초기화" }));
  expect(loadProfile().shortcuts).toEqual({});
  expect(loadProfile().mappings).toEqual(mappings);
  expect(screen.getByRole("button", { name: "다음 슬라이드 키 지정" })).toHaveTextContent("→");
  expect(screen.queryByRole("button", { name: /기본키 초기화/ })).not.toBeInTheDocument();
});

it("restores custom motions and keys when the page is mounted again", async () => {
  const user = userEvent.setup();
  const page = render(<Settings />);
  await user.selectOptions(screen.getByRole("combobox", { name: "다음 슬라이드 모션 선택" }), "");
  await user.selectOptions(screen.getByRole("combobox", { name: "이전 슬라이드 모션 선택" }), "swipe-right");
  await user.selectOptions(screen.getByRole("combobox", { name: "다음 슬라이드 모션 선택" }), "swipe-left");
  await user.click(screen.getByRole("button", { name: "다음 슬라이드 키 지정" }));
  await user.keyboard("k");
  page.unmount();
  render(<Settings />);
  expect(screen.getByRole("combobox", { name: "다음 슬라이드 모션 선택" })).toHaveValue("swipe-left");
  expect(screen.getByRole("combobox", { name: "이전 슬라이드 모션 선택" })).toHaveValue("swipe-right");
  expect(screen.getByRole("button", { name: "다음 슬라이드 키 지정" })).toHaveTextContent("K");
});

it.each(["thumbs-up", "thumbs-down", "ok", "three-fingers", "point-left", "point-right", "point-up"])("allows assigning and restoring %s", async (gesture) => {
  const page = render(<Settings />);
  const next = screen.getByRole("combobox", { name: "다음 슬라이드 모션 선택" });
  await userEvent.selectOptions(next, gesture);
  expect(loadProfile().mappings["next-slide"]).toBe(gesture);
  page.unmount();
  render(<Settings />);
  expect(screen.getByRole("combobox", { name: "다음 슬라이드 모션 선택" })).toHaveValue(gesture);
});

import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { DemoPresentation } from "./DemoPresentation";
import { PresentationPreparation } from "./PresentationPreparation";
import { usePresentationController } from "../features/presentation/usePresentationController";
const tracking = vi.hoisted(() => ({
  state: "tracking",
  gesture: (() => {}) as (gesture: string) => void,
  stop: () => {},
  mode: (async () => {}) as (mode: string) => Promise<void>,
}));
vi.mock("../features/camera/useHandTracking", () => ({ useHandTracking: (...args: unknown[]) => {
  tracking.gesture = args[5] as (gesture: string) => void;
  tracking.stop = args[10] as () => void;
  tracking.mode = args[6] as (mode: string) => Promise<void>;
  return { state: tracking.state, errorMessage: "" };
} }));
vi.mock("./PdfPage", () => ({ PdfPage: ({ pageNumber }: { pageNumber: number }) => <div>PDF page {pageNumber}</div> }));
beforeEach(() => {
  localStorage.clear(); delete window.motionAPI; tracking.state = "tracking";
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
function Preparation() { return <PresentationPreparation controller={usePresentationController()} />; }
it("opens one named demo window and focuses an existing popup", async () => {
  const focus = vi.fn();
  const open = vi.spyOn(window, "open").mockReturnValue({ closed: false, focus, postMessage: vi.fn() } as unknown as Window);
  render(<Preparation />);
  await userEvent.click(screen.getByRole("button", { name: "발표 시작" }));
  expect(open).toHaveBeenCalledWith(expect.stringContaining("?demo"), "adam-demo-presentation", expect.stringContaining("popup"));
  await userEvent.click(screen.getByRole("button", { name: "발표 시작" }));
  expect(open).toHaveBeenCalledTimes(1);
  expect(focus).toHaveBeenCalledTimes(2);
});
it("explains popup blocking and keeps PDF presentation disabled", async () => {
  vi.spyOn(window, "open").mockReturnValue(null);
  render(<Preparation />);
  await userEvent.click(screen.getByRole("button", { name: "발표 시작" }));
  expect(screen.getByRole("alert")).toHaveTextContent("팝업을 허용");
  await userEvent.click(screen.getByRole("button", { name: "내 PDF 업로드" }));
  expect(screen.getByRole("button", { name: "발표 시작" })).toBeDisabled();
});
it("navigates five slides with accessible icon buttons and keys", async () => {
  render(<DemoPresentation />);
  expect(screen.getByText("1 / 5")).toBeVisible();
  fireEvent.keyDown(window, { key: "End" });
  expect(screen.getByText("5 / 5")).toBeVisible();
  fireEvent.keyDown(window, { key: "ArrowLeft" });
  expect(screen.getByText("4 / 5")).toBeVisible();
  fireEvent.keyDown(window, { key: "Home" });
  expect(screen.getByText("1 / 5")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
  expect(screen.getByLabelText("데모 슬라이드")).not.toHaveClass("is-black");
  expect(screen.getByText("2 / 5")).toBeVisible();
  expect(screen.getByRole("heading", { name: "화면을 가리고 다시 켜보세요" })).toBeVisible();
  expect(document.querySelector("video")?.closest("[aria-hidden=true]")).not.toBeNull();
  expect(screen.queryByText("모션 진단")).not.toBeInTheDocument();
});
it("uses Fullscreen API and reports a rejected request", async () => {
  const request = vi.fn().mockRejectedValue(new Error("denied"));
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: request });
  render(<DemoPresentation />);
  await userEvent.click(screen.getByRole("button", { name: "전체 화면" }));
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
  expect(screen.getByRole("alert")).toHaveTextContent("전체 화면 권한");
  request.mockResolvedValue(undefined);
  await userEvent.click(screen.getByRole("button", { name: "전체 화면" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("retains camera permission errors with the compact controls", async () => {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) } });
  render(<DemoPresentation />);
  expect(screen.queryByRole("button", { name: "모션 시작" })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("카메라 권한"));
  expect(screen.queryByRole("button", { name: "발표 종료" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("button")).toHaveLength(3);
});

it("starts the control center camera and reuses it while restarting an existing popup", async () => {
  const postMessage = vi.fn();
  vi.spyOn(window, "open").mockReturnValue({ closed: false, focus: vi.fn(), postMessage } as unknown as Window);
  render(<Preparation />);
  await userEvent.click(screen.getByRole("button", { name: "발표 시작" }));
  await userEvent.click(screen.getByRole("button", { name: "발표 시작" }));
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  expect(postMessage).toHaveBeenCalledWith({ type: "start-presentation" }, window.location.origin);
});
it.each([false, true])("starts motion once in StrictMode and releases the camera on unmount (PDF: %s)", async (isPdf) => {
  const stop = vi.fn();
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  const { unmount } = render(<StrictMode><DemoPresentation pdf={isPdf ? { numPages: 12 } as PDFDocumentProxy : undefined} /></StrictMode>);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ON AIR"));
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "모션 시작" })).not.toBeInTheDocument();
  unmount();
  expect(stop).toHaveBeenCalledTimes(1);
});
it.each([false, true])("retries denied permission from the opener without toggling motion off (PDF: %s)", async (isPdf) => {
  Object.defineProperty(window, "opener", { configurable: true, value: window });
  const getMedia = vi.mocked(navigator.mediaDevices.getUserMedia);
  getMedia.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
  render(<DemoPresentation pdf={isPdf ? { numPages: 12 } as PDFDocumentProxy : undefined} />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("카메라 권한"));
  const restart = (origin: string) => fireEvent(window, new MessageEvent("message", { origin, source: window, data: { type: "start-presentation" } }));
  restart("https://untrusted.example");
  expect(getMedia).toHaveBeenCalledTimes(1);
  restart(window.location.origin);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ON AIR"));
  expect(getMedia).toHaveBeenCalledTimes(2);
  restart(window.location.origin);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ON AIR"));
  expect(getMedia).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("synchronizes fullscreen exit with the browser and supports keys while a control is focused", async () => {
  const exit = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  const { container } = render(<DemoPresentation />);
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: container.firstElementChild });
  fireEvent(document, new Event("fullscreenchange"));
  const control = screen.getByRole("button", { name: "전체 화면 종료" });
  fireEvent.keyDown(control, { key: "End" });
  expect(screen.getByText("5 / 5")).toBeVisible();
  await userEvent.click(control);
  expect(exit).toHaveBeenCalled();
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  fireEvent(document, new Event("fullscreenchange"));
  expect(screen.getByRole("button", { name: "전체 화면" })).toBeVisible();
});

it("opens an uploaded PDF in a named popup and reuses it", async () => {
  const create = vi.fn().mockReturnValue("blob:http://localhost/test-pdf");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  const focus = vi.fn();
  const postMessage = vi.fn();
  const open = vi.spyOn(window, "open").mockReturnValue({ closed: false, focus, postMessage } as unknown as Window);
  render(<Preparation />);
  await userEvent.click(screen.getByRole("button", { name: "내 PDF 업로드" }));
  const start = screen.getByRole("button", { name: "발표 시작" });
  expect(start).toBeDisabled();
  const file = new File(["%PDF-1.7 test"], "발표.pdf", { type: "application/pdf" });
  await userEvent.upload(screen.getByLabelText("발표 PDF 파일 선택"), file);
  expect(start).toBeEnabled();
  await userEvent.click(start);
  const url = new URL(open.mock.calls[0][0] as string);
  expect(url.searchParams.get("pdf")).toBe("blob:http://localhost/test-pdf");
  expect(url.searchParams.get("name")).toBe("발표.pdf");
  expect(open.mock.calls[0][1]).toBe("adam-pdf-presentation");
  await userEvent.click(start);
  expect(open).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith(file);
  expect(focus).toHaveBeenCalledTimes(2);
  expect(postMessage).toHaveBeenCalledWith({ type: "start-presentation" }, window.location.origin);
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
});

it("rejects invalid dropped files and releases a PDF URL when the popup is blocked", async () => {
  const revoke = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
  vi.spyOn(window, "open").mockReturnValue(null);
  render(<Preparation />);
  await userEvent.click(screen.getByRole("button", { name: "내 PDF 업로드" }));
  const drop = screen.getByText("PDF를 여기로 끌어 놓으세요").parentElement!;
  fireEvent.drop(drop, { dataTransfer: { files: [new File(["x"], "bad.txt")] } });
  expect(screen.getByRole("alert")).toHaveTextContent("PDF 파일을 선택");
  expect(screen.getByRole("button", { name: "발표 시작" })).toBeDisabled();
  fireEvent.drop(drop, { dataTransfer: { files: [new File(["%PDF"], "slides.pdf")] } });
  await userEvent.click(screen.getByRole("button", { name: "발표 시작" }));
  expect(screen.getByRole("alert")).toHaveTextContent("팝업이 차단");
  expect(revoke).toHaveBeenCalledWith("blob:test");
});


it("uses the PDF page count for navigation beyond the demo deck", async () => {
  render(<DemoPresentation pdf={{ numPages: 12 } as PDFDocumentProxy} />);
  expect(screen.getByText("1 / 12")).toBeVisible();
  expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
  fireEvent.keyDown(window, { key: "End" });
  expect(screen.getByText("PDF page 12")).toBeVisible();
  expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "이전" }));
  expect(screen.getByText("11 / 12")).toBeVisible();
  fireEvent.keyDown(window, { key: "Home" });
  expect(screen.getByText("PDF page 1")).toBeVisible();
});

it.each([false, true])("shows emergency pause and gesture resume clearly (PDF: %s)", async (isPdf) => {
  render(<DemoPresentation pdf={isPdf ? { numPages: 4 } as PDFDocumentProxy : undefined} />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ON AIR"));
  act(() => tracking.stop());
  expect(screen.getByRole("status")).toHaveTextContent("PAUSED");
  expect(screen.getByRole("status")).toHaveAttribute("title", expect.stringContaining("엄지·새끼손가락을 펴면 재개"));
  await act(async () => tracking.gesture("toggle-motion"));
  expect(screen.getByRole("status")).toHaveTextContent("ON AIR");
});
it.each(["loading", "no-hand", "tracking", "error"])("keeps the on-air indicator stable for tracker %s", async (state) => {
  tracking.state = state;
  render(<DemoPresentation />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ON AIR"));
});

it.each([false, true])("returns the indicator to ON AIR after a paused slide-return pose (PDF: %s)", async (isPdf) => {
  render(<DemoPresentation pdf={isPdf ? { numPages: 4 } as PDFDocumentProxy : undefined} />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ON AIR"));
  await act(async () => { await tracking.mode("cursor"); });
  act(() => tracking.stop());
  expect(screen.getByRole("status")).toHaveTextContent("PAUSED");
  await act(async () => { await tracking.mode("slide"); });
  expect(screen.getByRole("status")).toHaveTextContent("ON AIR");
});

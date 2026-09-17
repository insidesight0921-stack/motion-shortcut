const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
  screen,
  systemPreferences,
} = require("electron");
const { execFile, spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const allowedApps = Object.freeze({
  calculator: { name: "계산기", mac: "Calculator" },
  notes: { name: "메모", mac: "Notes" },
  chrome: { name: "Chrome", mac: "Google Chrome" },
  spotlight: { name: "Spotlight", action: "spotlight" },
});
let overlayWindow = null;
let keyboardWindow = null;
let mainWindow = null;
let laserWindow = null;
let restoreMainWindowAfterKeyboard = false;
let keyboardVisible = false;
let overlayMode = "camera";
let presentationMode = "slide";
let motionEnabled = false;
let cameraEnabled = false;
let selectedDisplayId = null;
let cursorEnabled = false;
let cursorSensitivity = 1;
let typingSensitivity = 0.35;
let cursorHelper = null;
let cursorPosition = null;
let overlayEditing = false;
let overlayScale = 1;
let presentationAppName = null;
let laserSettings = {
  color: "#9fe9ff",
  size: 24,
  trail: true,
  shareCompatible: false,
};
const resourceOpenedAt = new Map();
const presentationCommandAt = new Map();
const lastKeyboardTap = { Left: 0, Right: 0 };
const OVERLAY_BASE_SIZE = { width: 320, height: 420 };
const LASER_WINDOW_SIZE = 140;

async function getFrontmostAppName() {
  if (process.platform !== "darwin") return null;
  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", [
      "-e",
      'tell application "System Events" to get name of first application process whose frontmost is true',
    ]);
    const name = stdout.trim();
    return name && !/^(Flickey|Electron)$/i.test(name) ? name : null;
  } catch {
    return null;
  }
}

async function activateAppByName(name) {
  if (!name || process.platform !== "darwin")
    return { ok: false, error: "복귀할 발표 창을 찾지 못했습니다." };
  try {
    await execFileAsync("/usr/bin/osascript", [
      "-e",
      "on run argv\ntell application (item 1 of argv) to activate\nend run",
      name,
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: `${name} 창으로 복귀하지 못했습니다.` };
  }
}

async function activateChromePresentationTab(rawUrl) {
  if (!rawUrl) return activateAppByName("Google Chrome");
  try {
    const target = new URL(rawUrl);
    const googleSlidesMatch = target.pathname.match(
      /\/presentation\/d\/(?:e\/)?[^/]+/,
    );
    const isGoogleSlides =
      target.hostname === "docs.google.com" && Boolean(googleSlidesMatch);
    const match = isGoogleSlides
      ? `${target.origin}${googleSlidesMatch[0]}/`
      : `${target.origin}${target.pathname}`;
    const { stdout } = await execFileAsync("/usr/bin/osascript", [
      "-e",
      'on run argv\nset targetURL to item 1 of argv\nset googleSlides to item 2 of argv is "true"\ntell application "Google Chrome"\nif googleSlides then\nrepeat with w from 1 to count of windows\nrepeat with t from 1 to count of tabs of window w\nset tabURL to URL of tab t of window w\nif tabURL starts with targetURL and (tabURL contains "/present" or tabURL contains "/preview") then\nset active tab index of window w to t\nset index of window w to 1\nactivate\nreturn "present"\nend if\nend repeat\nend repeat\nelse\nrepeat with w from 1 to count of windows\nrepeat with t from 1 to count of tabs of window w\nif URL of tab t of window w starts with targetURL then\nset active tab index of window w to t\nset index of window w to 1\nactivate\nreturn "found"\nend if\nend repeat\nend repeat\nend if\nend tell\nreturn "missing"\nend run',
      match,
      String(isGoogleSlides),
    ]);
    const status = stdout.trim();
    if (status === "found" || status === "present") return { ok: true };
    return {
      ok: false,
      error: isGoogleSlides
        ? "Google Slides 발표 모드 창을 찾지 못했습니다. 먼저 슬라이드 쇼를 시작하세요."
        : "지정한 발표 링크의 Chrome 탭을 찾지 못했습니다.",
    };
  } catch {
    return {
      ok: false,
      error: "발표 링크의 Chrome 탭을 활성화하지 못했습니다.",
    };
  }
}

function presentationUrlFor(rawUrl) {
  try {
    const url = new URL(String(rawUrl));
    if (url.hostname !== "docs.google.com") return url.toString();
    const match = url.pathname.match(/^(\/presentation\/d\/(?:e\/)?[^/]+)/);
    if (!match) return url.toString();
    url.pathname = `${match[1]}/present`;
    if (!url.searchParams.has("slide")) url.searchParams.set("slide", "id.p");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function overlayLayoutPath() {
  return path.join(app.getPath("userData"), "overlay-layout.json");
}

function laserSettingsPath() {
  return path.join(app.getPath("userData"), "laser-settings.json");
}

function readLaserSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(laserSettingsPath(), "utf8"));
    return {
      color: /^#[0-9a-f]{6}$/i.test(saved.color) ? saved.color : "#9fe9ff",
      size: Math.max(12, Math.min(48, Number(saved.size) || 24)),
      trail: saved.trail !== false,
      shareCompatible: Boolean(saved.shareCompatible),
    };
  } catch {
    return {
      color: "#9fe9ff",
      size: 24,
      trail: true,
      shareCompatible: false,
    };
  }
}

function saveLaserSettings() {
  fs.writeFileSync(laserSettingsPath(), JSON.stringify(laserSettings));
}

function readOverlayLayout(area) {
  try {
    const saved = JSON.parse(fs.readFileSync(overlayLayoutPath(), "utf8"));
    const scale = Math.max(0.6, Math.min(1.6, Number(saved.scale) || 1));
    const width = Math.round(OVERLAY_BASE_SIZE.width * scale);
    const height = Math.round(OVERLAY_BASE_SIZE.height * scale);
    const savedX = Number.isFinite(Number(saved.x))
      ? Number(saved.x)
      : area.x + area.width - width - 20;
    const savedY = Number.isFinite(Number(saved.y))
      ? Number(saved.y)
      : area.y + area.height - height - 20;
    return {
      x: Math.max(area.x, Math.min(area.x + area.width - width, savedX)),
      y: Math.max(area.y, Math.min(area.y + area.height - height, savedY)),
      width,
      height,
      scale,
    };
  } catch {
    return {
      x: area.x + area.width - 340,
      y: area.y + area.height - 440,
      ...OVERLAY_BASE_SIZE,
      scale: 1,
    };
  }
}

function saveOverlayLayout() {
  if (!overlayWindow) return;
  const { x, y } = overlayWindow.getBounds();
  fs.writeFileSync(
    overlayLayoutPath(),
    JSON.stringify({ x, y, scale: overlayScale }),
  );
}

function broadcastMotionState() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("motion:changed", motionEnabled);
  }
}

function broadcastCameraState() {
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send("camera:changed", cameraEnabled);
}

function getControlDisplay() {
  const displays = screen.getAllDisplays();
  return (
    displays.find(
      (display) => String(display.id) === String(selectedDisplayId),
    ) || screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  );
}

function broadcastCursorState() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("cursor:changed", cursorEnabled);
  }
}

function stopCursorHelper() {
  cursorHelper?.kill();
  cursorHelper = null;
  cursorPosition = null;
}

function ensureCursorHelper() {
  if (process.platform !== "darwin") return false;
  if (cursorHelper && !cursorHelper.killed) return true;
  const isBundled = app.isPackaged || __dirname.includes("app.asar");
  const helperDirectory = path.join(app.getPath("userData"), "native");
  const helperPath = isBundled
    ? path.join(process.resourcesPath, "native", "motion-cursor-helper")
    : path.join(helperDirectory, "motion-cursor-helper");
  const sourcePath = path.join(__dirname, "cursor-helper.c");
  try {
    if (isBundled) {
      if (!fs.existsSync(helperPath)) return false;
    } else {
      fs.mkdirSync(helperDirectory, { recursive: true });
      const sourceChanged =
        !fs.existsSync(helperPath) ||
        fs.statSync(sourcePath).mtimeMs > fs.statSync(helperPath).mtimeMs;
      if (!sourceChanged) {
        cursorHelper = spawn(helperPath, [], {
          stdio: ["pipe", "ignore", "pipe"],
        });
      } else {
        const compiled = spawnSync(
          "/usr/bin/clang",
          [
            sourcePath,
            "-framework",
            "ApplicationServices",
            "-framework",
            "Carbon",
            "-o",
            helperPath,
          ],
          { encoding: "utf8" },
        );
        if (compiled.status !== 0) {
          console.error(`[cursor-helper] ${compiled.stderr}`);
          return false;
        }
      }
    }
  } catch (error) {
    console.error("[cursor-helper] build failed", error);
    return false;
  }
  if (!cursorHelper)
    cursorHelper = spawn(helperPath, [], {
      stdio: ["pipe", "ignore", "pipe"],
    });
  cursorHelper.on("exit", () => {
    cursorHelper = null;
    cursorPosition = null;
  });
  cursorHelper.stderr.on("data", (data) =>
    console.error(`[cursor-helper] ${String(data).trim()}`),
  );
  return true;
}

function setCursorEnabled(enabled, promptForAccess = false) {
  if (enabled && process.platform === "darwin") {
    const trusted =
      systemPreferences.isTrustedAccessibilityClient(promptForAccess);
    if (!trusted)
      return {
        ok: false,
        enabled: false,
        error: "손쉬운 사용 권한을 허용한 뒤 다시 시도하세요.",
      };
    if (!ensureCursorHelper()) {
      return {
        ok: false,
        enabled: false,
        error: "커서 제어 모듈을 시작하지 못했습니다.",
      };
    }
  }
  cursorEnabled = Boolean(enabled);
  if (!cursorEnabled) stopCursorHelper();
  broadcastCursorState();
  return { ok: true, enabled: cursorEnabled };
}

ipcMain.handle("motion:get", () => motionEnabled);
ipcMain.handle("motion:set", (_event, enabled) => {
  if (enabled && !cameraEnabled) return false;
  motionEnabled = Boolean(enabled);
  if (!motionEnabled) {
    setCursorEnabled(false);
    laserWindow?.hide();
  } else if (presentationMode === "cursor") {
    setCursorEnabled(true, false);
  }
  broadcastMotionState();
  return motionEnabled;
});
ipcMain.handle("motion:toggle", () => {
  if (!motionEnabled && !cameraEnabled) return false;
  motionEnabled = !motionEnabled;
  if (!motionEnabled) {
    setCursorEnabled(false);
    laserWindow?.hide();
  } else if (presentationMode === "cursor") {
    setCursorEnabled(true, false);
  }
  broadcastMotionState();
  return motionEnabled;
});
ipcMain.handle("camera:get", () => cameraEnabled);
ipcMain.handle("camera:set", (_event, enabled) => {
  cameraEnabled = Boolean(enabled);
  if (!cameraEnabled) {
    motionEnabled = false;
    setCursorEnabled(false);
    laserWindow?.hide();
    broadcastMotionState();
  }
  broadcastCameraState();
  return cameraEnabled;
});
ipcMain.handle("system:permissions", () => ({
  camera: systemPreferences.getMediaAccessStatus("camera"),
  screen: systemPreferences.getMediaAccessStatus("screen"),
  accessibility: systemPreferences.isTrustedAccessibilityClient(false)
    ? "granted"
    : "denied",
}));
ipcMain.handle("system:open-permission", async (_event, permission) => {
  const panes = {
    camera: "Privacy_Camera",
    accessibility: "Privacy_Accessibility",
    screen: "Privacy_ScreenCapture",
  };
  const pane = panes[permission];
  if (!pane) return false;
  if (permission === "accessibility") {
    // 사용자가 권한 점검 버튼을 직접 눌렀을 때만 macOS 권한 목록에
    // 현재 Flickey 번들을 등록한다. 모션 실행 중에는 팝업을 요청하지 않는다.
    systemPreferences.isTrustedAccessibilityClient(true);
  }
  await shell.openExternal(
    `x-apple.systempreferences:com.apple.preference.security?${pane}`,
  );
  return true;
});
ipcMain.handle("display:list", () => ({
  selectedId: selectedDisplayId,
  displays: screen.getAllDisplays().map((display, index) => ({
    id: String(display.id),
    label: `모니터 ${index + 1} · ${display.size.width}×${display.size.height}`,
    primary: display.id === screen.getPrimaryDisplay().id,
  })),
}));
ipcMain.handle("display:set", (_event, id) => {
  const found = screen
    .getAllDisplays()
    .find((display) => String(display.id) === String(id));
  selectedDisplayId = found ? String(found.id) : null;
  return selectedDisplayId;
});
ipcMain.handle("cursor:get", () => cursorEnabled);
ipcMain.handle("cursor:get-sensitivity", () => cursorSensitivity);
ipcMain.handle("cursor:set-sensitivity", (_event, value) => {
  cursorSensitivity = Math.max(0.6, Math.min(2, Number(value) || 1));
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("cursor:sensitivity-changed", cursorSensitivity);
  }
  return cursorSensitivity;
});
ipcMain.handle("cursor:toggle", () => setCursorEnabled(!cursorEnabled, false));
ipcMain.handle("cursor:set", (_event, enabled) =>
  setCursorEnabled(Boolean(enabled), false),
);
ipcMain.on("cursor:move", (_event, point) => {
  if (
    !motionEnabled ||
    presentationMode !== "cursor" ||
    !cursorEnabled ||
    !point ||
    !ensureCursorHelper()
  )
    return;
  const display = getControlDisplay();
  const area = display.bounds;
  const target = {
    x: area.x + Math.max(0, Math.min(1, Number(point.x))) * area.width,
    y: area.y + Math.max(0, Math.min(1, Number(point.y))) * area.height,
  };
  const smoothing = cursorPosition ? 0.28 : 1;
  cursorPosition = {
    x: cursorPosition
      ? cursorPosition.x + (target.x - cursorPosition.x) * smoothing
      : target.x,
    y: cursorPosition
      ? cursorPosition.y + (target.y - cursorPosition.y) * smoothing
      : target.y,
  };
  cursorHelper.stdin.write(
    `move ${cursorPosition.x.toFixed(1)} ${cursorPosition.y.toFixed(1)}\n`,
  );
});
ipcMain.on("cursor:click", () => {
  if (
    !motionEnabled ||
    presentationMode !== "cursor" ||
    !cursorEnabled ||
    !ensureCursorHelper()
  )
    return;
  cursorHelper.stdin.write("click\n");
});

function broadcastKeyboardState() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("keyboard:changed", keyboardVisible);
  }
}

function createKeyboardWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  keyboardWindow = new BrowserWindow({
    width: Math.min(920, area.width - 40),
    height: 310,
    x: area.x + Math.round((area.width - Math.min(920, area.width - 40)) / 2),
    y: area.y + area.height - 330,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  keyboardWindow.setAlwaysOnTop(true, "floating");
  keyboardWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const target = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}?keyboard=1`
    : `file://${path.join(__dirname, "..", "dist", "index.html")}?keyboard=1`;
  keyboardWindow.loadURL(target);
  keyboardWindow.on("closed", () => {
    keyboardWindow = null;
  });
}

function setKeyboardVisible(visible) {
  if (!visible && !keyboardWindow) {
    keyboardVisible = false;
    broadcastKeyboardState();
    return false;
  }
  if (!keyboardWindow) createKeyboardWindow();
  keyboardVisible = Boolean(visible);
  if (keyboardVisible) {
    if (process.platform === "darwin") {
      const trusted = systemPreferences.isTrustedAccessibilityClient(false);
      if (trusted && ensureCursorHelper()) {
        cursorHelper.stdin.write("input-korean\n");
      }
    }
    if (mainWindow?.isFocused()) {
      restoreMainWindowAfterKeyboard = true;
      mainWindow.hide();
    }
    if (overlayMode !== "camera" && overlayWindow) {
      overlayWindow.setOpacity(0);
      overlayWindow.showInactive();
    }
    keyboardWindow.showInactive();
  } else {
    if (cursorHelper && !cursorHelper.killed) {
      cursorHelper.stdin.write("input-restore\n");
    }
    keyboardWindow.hide();
    if (restoreMainWindowAfterKeyboard && mainWindow) {
      mainWindow.show();
      restoreMainWindowAfterKeyboard = false;
    }
    if (overlayMode !== "camera" && overlayWindow) {
      overlayWindow.setOpacity(1);
      overlayWindow.showInactive();
    }
  }
  broadcastKeyboardState();
  return keyboardVisible;
}

ipcMain.handle("keyboard:get", () => false);
ipcMain.handle("keyboard:get-sensitivity", () => typingSensitivity);
ipcMain.handle("keyboard:set-sensitivity", (_event, value) => {
  typingSensitivity = Math.max(0.2, Math.min(1, Number(value) || 0.35));
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("keyboard:sensitivity-changed", typingSensitivity);
  }
  return typingSensitivity;
});
ipcMain.handle("keyboard:set", () => setKeyboardVisible(false));
ipcMain.handle("keyboard:toggle", () => setKeyboardVisible(false));
const macKeyCodes = Object.freeze({
  a: 0,
  s: 1,
  d: 2,
  f: 3,
  h: 4,
  g: 5,
  z: 6,
  x: 7,
  c: 8,
  v: 9,
  b: 11,
  q: 12,
  w: 13,
  e: 14,
  r: 15,
  y: 16,
  t: 17,
  1: 18,
  2: 19,
  3: 20,
  4: 21,
  6: 22,
  5: 23,
  9: 25,
  7: 26,
  8: 28,
  0: 29,
  o: 31,
  u: 32,
  i: 34,
  p: 35,
  l: 37,
  j: 38,
  k: 40,
  n: 45,
  m: 46,
  Space: 49,
  Backspace: 51,
  Enter: 36,
  Tab: 48,
  ArrowLeft: 123,
  ArrowRight: 124,
  Escape: 53,
});

function sendMacKey(key) {
  if (
    process.platform === "darwin" &&
    !systemPreferences.isTrustedAccessibilityClient(false)
  ) {
    return {
      ok: false,
      error: "시스템 설정에서 Flickey의 손쉬운 사용 권한이 필요합니다.",
    };
  }
  if (!ensureCursorHelper())
    return { ok: false, error: "macOS 입력 모듈을 시작하지 못했습니다." };
  const keyCode = macKeyCodes[key];
  if (keyCode === undefined)
    return { ok: false, error: "지원하지 않는 발표 명령입니다." };
  cursorHelper.stdin.write(`key ${keyCode}\n`);
  return { ok: true };
}

function reportPresentationActivity(command, result) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("presentation:activity", { command, ...result });
  }
  return result;
}

ipcMain.handle(
  "presentation:execute",
  async (_event, command, appId, presentationUrl) => {
    const keys = {
      "next-slide": "ArrowRight",
      "previous-slide": "ArrowLeft",
      "black-screen": "b",
      "exit-presentation": "Escape",
    };
    const key = keys[command];
    const now = Date.now();
    if (now - (presentationCommandAt.get(command) || 0) < 650)
      return reportPresentationActivity(command, {
        ok: false,
        error: "같은 명령의 연속 실행을 차단했습니다.",
      });
    const appNames = {
      powerpoint: "Microsoft PowerPoint",
      keynote: "Keynote",
      "google-slides": "Google Chrome",
      "web-slides": "Google Chrome",
    };
    const expectedApp = appNames[appId];
    const isWebPresentation =
      appId === "google-slides" || appId === "web-slides";
    const frontmost = await getFrontmostAppName();
    if (
      !isWebPresentation &&
      expectedApp &&
      frontmost &&
      frontmost !== expectedApp
    )
      return reportPresentationActivity(command, {
        ok: false,
        error: `${expectedApp}이(가) 활성 창이 아닙니다. 발표 화면으로 돌아간 뒤 시도하세요.`,
      });
    if (isWebPresentation || (expectedApp && !frontmost)) {
      const focused = isWebPresentation
        ? await activateChromePresentationTab(presentationUrl)
        : await activateAppByName(expectedApp);
      if (!focused.ok) return reportPresentationActivity(command, focused);
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (expectedApp) presentationAppName = expectedApp;
    if (!key)
      return reportPresentationActivity(command, {
        ok: false,
        error: "허용되지 않은 발표 명령입니다.",
      });
    const result = sendMacKey(key);
    if (result.ok) presentationCommandAt.set(command, now);
    return reportPresentationActivity(command, result);
  },
);

ipcMain.handle("presentation:pick-file", async (_event, applicationOnly) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: applicationOnly ? "애플리케이션 선택" : "발표 자료 선택",
    properties: ["openFile"],
    filters: applicationOnly
      ? [{ name: "Applications", extensions: ["app"] }]
      : undefined,
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("presentation:open-resource", async (_event, resource) => {
  if (!resource || typeof resource.value !== "string" || !resource.value)
    return { ok: false, error: "등록된 자료가 없습니다." };
  try {
    const key = `${resource.kind}:${resource.value}`;
    const now = Date.now();
    if (now - (resourceOpenedAt.get(key) || 0) < 2500)
      return {
        ok: false,
        error: "방금 실행한 자료입니다. 잠시 후 다시 시도하세요.",
      };
    const frontmost = await getFrontmostAppName();
    if (frontmost) presentationAppName = frontmost;
    if (resource.kind === "url") {
      const url = new URL(resource.value);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      await shell.openExternal(url.toString());
    } else {
      const error = await shell.openPath(resource.value);
      if (error) return { ok: false, error };
    }
    resourceOpenedAt.set(key, now);
    if (resource.returnAfterMs && presentationAppName) {
      const delay = Math.max(
        1000,
        Math.min(30000, Number(resource.returnAfterMs)),
      );
      setTimeout(() => void activateAppByName(presentationAppName), delay);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "자료를 열지 못했습니다." };
  }
});

ipcMain.handle("presentation:restore", () =>
  activateAppByName(presentationAppName),
);

ipcMain.handle("presentation:open-url", async (_event, rawUrl) => {
  try {
    const url = new URL(presentationUrlFor(rawUrl));
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new Error();
    await execFileAsync("/usr/bin/open", [
      "-a",
      "Google Chrome",
      url.toString(),
    ]);
    presentationAppName = "Google Chrome";
    return { ok: true, url: url.toString() };
  } catch {
    return {
      ok: false,
      error: "올바른 웹 링크인지, Chrome이 설치되어 있는지 확인하세요.",
    };
  }
});

ipcMain.handle(
  "presentation:go-to-slide",
  async (_event, requestedSlide, appId, presentationUrl) => {
    const slide = Math.max(
      1,
      Math.min(9999, Math.floor(Number(requestedSlide))),
    );
    if (!Number.isFinite(slide))
      return { ok: false, error: "올바른 슬라이드 번호를 입력하세요." };
    if (
      process.platform === "darwin" &&
      !systemPreferences.isTrustedAccessibilityClient(false)
    )
      return {
        ok: false,
        error: "슬라이드 이동에 손쉬운 사용 권한이 필요합니다.",
      };
    const appNames = {
      powerpoint: "Microsoft PowerPoint",
      keynote: "Keynote",
      "google-slides": "Google Chrome",
      "web-slides": "Google Chrome",
    };
    const expectedApp = appNames[appId];
    const isWebPresentation =
      appId === "google-slides" || appId === "web-slides";
    const frontmost = await getFrontmostAppName();
    if (
      !isWebPresentation &&
      expectedApp &&
      frontmost &&
      frontmost !== expectedApp
    )
      return { ok: false, error: `${expectedApp}이(가) 활성 창이 아닙니다.` };
    if (isWebPresentation || (expectedApp && !frontmost)) {
      const focused = isWebPresentation
        ? await activateChromePresentationTab(presentationUrl)
        : await activateAppByName(expectedApp);
      if (!focused.ok) return focused;
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (!ensureCursorHelper())
      return { ok: false, error: "macOS 입력 모듈을 시작하지 못했습니다." };
    for (const digit of String(slide))
      cursorHelper.stdin.write(`type ${digit.charCodeAt(0)}\n`);
    cursorHelper.stdin.write(`key ${macKeyCodes.Enter}\n`);
    return { ok: true };
  },
);
ipcMain.handle("keyboard:type", (_event, key) => {
  if (!keyboardVisible) return { ok: false, error: "키보드가 닫혀 있습니다." };
  if (
    process.platform === "darwin" &&
    !systemPreferences.isTrustedAccessibilityClient(false)
  ) {
    return {
      ok: false,
      error: "시스템 설정에서 모션 단축키의 손쉬운 사용 권한이 필요합니다.",
    };
  }
  if (!ensureCursorHelper()) {
    return { ok: false, error: "macOS 입력 모듈을 시작하지 못했습니다." };
  }
  const normalized = key === " " ? "Space" : String(key);
  const baseKey =
    normalized.length === 1 ? normalized.toLowerCase() : normalized;
  const keyCode = macKeyCodes[baseKey];
  if (keyCode === undefined)
    return { ok: false, error: "지원하지 않는 키입니다." };
  const shifted = normalized.length === 1 && normalized !== baseKey;
  cursorHelper.stdin.write(`${shifted ? "keyshift" : "key"} ${keyCode}\n`);
  return { ok: true };
});
ipcMain.on("keyboard:pointer", (_event, sample) => {
  if (!keyboardVisible || !keyboardWindow || !sample) return;
  const bounds = keyboardWindow.getBounds();
  const hand = sample.hand === "Left" ? "Left" : "Right";
  let tap = Boolean(sample.tap);
  const now = Date.now();
  if (tap && now - lastKeyboardTap[hand] < 280) tap = false;
  if (tap) lastKeyboardTap[hand] = now;
  keyboardWindow.webContents.send("keyboard:pointer", {
    hand,
    x: Math.max(0, Math.min(1, Number(sample.x))) * bounds.width,
    y: Math.max(0, Math.min(1, Number(sample.y))) * bounds.height,
    tap,
  });
});
ipcMain.on("keyboard:hands", (_event, hands) => {
  if (!keyboardVisible || !keyboardWindow || !Array.isArray(hands)) return;
  keyboardWindow.webContents.send("keyboard:hands", hands);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 880,
    minHeight: 640,
    title: "Flickey",
    backgroundColor: "#080909",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createLaserWindow() {
  laserWindow = new BrowserWindow({
    width: LASER_WINDOW_SIZE,
    height: LASER_WINDOW_SIZE,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  laserWindow.setAlwaysOnTop(true, "screen-saver");
  laserWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  laserWindow.setIgnoreMouseEvents(true);
  const target = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}?laser=1`
    : `file://${path.join(__dirname, "..", "dist", "index.html")}?laser=1`;
  laserWindow.loadURL(target);
  laserWindow.on("closed", () => {
    laserWindow = null;
  });
}

function broadcastLaserSettings() {
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send("laser:settings-changed", laserSettings);
}

ipcMain.handle("laser:get-settings", () => laserSettings);
ipcMain.handle("laser:set-settings", (_event, next) => {
  const color = /^#[0-9a-f]{6}$/i.test(next?.color)
    ? next.color
    : laserSettings.color;
  laserSettings = {
    color,
    size: Math.max(12, Math.min(48, Number(next?.size) || laserSettings.size)),
    trail: Boolean(next?.trail),
    shareCompatible: Boolean(next?.shareCompatible),
  };
  saveLaserSettings();
  broadcastLaserSettings();
  return laserSettings;
});

function broadcastPresentationMode() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("presentation:mode-changed", presentationMode);
  }
}

function setPresentationMode(nextMode) {
  if (!["slide", "cursor", "laser"].includes(nextMode))
    return {
      ok: false,
      mode: presentationMode,
      error: "지원하지 않는 모드입니다.",
    };
  if (nextMode !== "cursor") setCursorEnabled(false);
  if (nextMode === "cursor" && motionEnabled) {
    const result = setCursorEnabled(true, false);
    if (!result.ok) return { ...result, mode: presentationMode };
  }
  presentationMode = nextMode;
  if (!laserWindow) createLaserWindow();
  laserWindow.hide();
  broadcastPresentationMode();
  return { ok: true, mode: presentationMode };
}

ipcMain.handle("presentation:get-mode", () => presentationMode);
ipcMain.handle("presentation:set-mode", (_event, mode) =>
  setPresentationMode(mode),
);
ipcMain.handle("presentation:cycle-mode", () => {
  const order = ["slide", "cursor", "laser"];
  return setPresentationMode(order[(order.indexOf(presentationMode) + 1) % 3]);
});
ipcMain.on("laser:move", (_event, point) => {
  if (!motionEnabled || presentationMode !== "laser" || !laserWindow || !point)
    return;
  const display = getControlDisplay();
  const area = display.bounds;
  const x = area.x + Math.max(0, Math.min(1, Number(point.x))) * area.width;
  const y = area.y + Math.max(0, Math.min(1, Number(point.y))) * area.height;
  if (laserSettings.shareCompatible && ensureCursorHelper())
    cursorHelper.stdin.write(`move ${x.toFixed(1)} ${y.toFixed(1)}\n`);
  laserWindow.setPosition(
    Math.round(x - LASER_WINDOW_SIZE / 2),
    Math.round(y - LASER_WINDOW_SIZE / 2),
    false,
  );
  laserWindow.webContents.send("laser:moved");
  laserWindow.showInactive();
});

function createOverlayWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  const layout = readOverlayLayout(area);
  overlayScale = layout.scale;
  overlayWindow = new BrowserWindow({
    width: layout.width,
    height: layout.height,
    x: layout.x,
    y: layout.y,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  overlayWindow.setAlwaysOnTop(true, "floating");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.on("moved", saveOverlayLayout);
  const target = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}?overlay=1`
    : `file://${path.join(__dirname, "..", "dist", "index.html")}?overlay=1`;
  overlayWindow.loadURL(target);
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

ipcMain.handle("overlay:get-mode", () => overlayMode);
ipcMain.handle("overlay:set-mode", (_event, mode) => {
  if (!["camera", "person-pet", "hand-pet"].includes(mode)) return false;
  overlayMode = mode;
  if (!overlayWindow) createOverlayWindow();
  overlayWindow.webContents.send("overlay:mode", mode);
  if (mode === "camera") overlayWindow.hide();
  else {
    overlayWindow.setOpacity(keyboardVisible ? 0 : 1);
    overlayWindow.showInactive();
  }
  return true;
});

ipcMain.handle("overlay:set-color", (_event, color) => {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return false;
  overlayWindow?.webContents.send("overlay:color", color);
  return true;
});

ipcMain.handle("overlay:get-layout", () => ({
  scale: overlayScale,
  editing: overlayEditing,
}));
ipcMain.handle("overlay:set-scale", (_event, nextScale) => {
  if (!overlayWindow) createOverlayWindow();
  overlayScale = Math.max(0.6, Math.min(1.6, Number(nextScale) || 1));
  const bounds = overlayWindow.getBounds();
  const width = Math.round(OVERLAY_BASE_SIZE.width * overlayScale);
  const height = Math.round(OVERLAY_BASE_SIZE.height * overlayScale);
  overlayWindow.setBounds({
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + bounds.height - height),
    width,
    height,
  });
  saveOverlayLayout();
  return overlayScale;
});
ipcMain.handle("overlay:set-editing", (_event, editing) => {
  if (!overlayWindow) createOverlayWindow();
  overlayEditing = Boolean(editing);
  overlayWindow.setIgnoreMouseEvents(!overlayEditing);
  overlayWindow.webContents.send("overlay:editing", overlayEditing);
  if (overlayEditing && overlayMode !== "camera") overlayWindow.showInactive();
  return overlayEditing;
});
ipcMain.on("overlay:tracking", (_event, tracking) => {
  mainWindow?.webContents.send("overlay:tracking", tracking);
});

ipcMain.handle("apps:launch", async (_event, appId) => {
  const target = allowedApps[appId];
  if (!target) return { ok: false, error: "허용되지 않은 프로그램입니다." };
  if (process.platform !== "darwin")
    return { ok: false, error: "현재 MVP는 macOS만 지원합니다." };

  try {
    if (target.action === "spotlight") {
      await execFileAsync("/usr/bin/osascript", [
        "-e",
        'tell application "System Events" to key code 49 using command down',
      ]);
      return { ok: true, appName: target.name };
    }
    await execFileAsync("/usr/bin/open", ["-a", target.mac]);
    return { ok: true, appName: target.name };
  } catch (error) {
    if (
      appId === "spotlight" &&
      /assistive access|not authorized|1002/i.test(String(error))
    ) {
      return {
        ok: false,
        error:
          "Spotlight 실행 권한이 없습니다. 시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용에서 Electron을 허용하세요.",
      };
    }
    return { ok: false, error: `${target.name}을(를) 열지 못했습니다.` };
  }
});

app.whenReady().then(() => {
  laserSettings = readLaserSettings();
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const trusted =
        webContents.getURL().startsWith("http://127.0.0.1:5173") ||
        webContents.getURL().startsWith("file:");
      callback(trusted && permission === "media");
    },
  );
  createWindow();
  createOverlayWindow();
  createLaserWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", stopCursorHelper);

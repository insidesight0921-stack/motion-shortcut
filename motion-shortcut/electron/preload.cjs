const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("motionAPI", {
  launchApp: (appId) => ipcRenderer.invoke("apps:launch", appId),
  executePresentationCommand: (command, presentationApp, presentationUrl) =>
    ipcRenderer.invoke(
      "presentation:execute",
      command,
      presentationApp,
      presentationUrl,
    ),
  pickPresentationFile: (applicationOnly = false) =>
    ipcRenderer.invoke("presentation:pick-file", applicationOnly),
  openPresentationResource: (resource) =>
    ipcRenderer.invoke("presentation:open-resource", resource),
  restorePresentation: () => ipcRenderer.invoke("presentation:restore"),
  openPresentationUrl: (url) =>
    ipcRenderer.invoke("presentation:open-url", url),
  goToSlide: (slide, presentationApp, presentationUrl) =>
    ipcRenderer.invoke(
      "presentation:go-to-slide",
      slide,
      presentationApp,
      presentationUrl,
    ),
  getPresentationMode: () => ipcRenderer.invoke("presentation:get-mode"),
  setPresentationMode: (mode) =>
    ipcRenderer.invoke("presentation:set-mode", mode),
  cyclePresentationMode: () => ipcRenderer.invoke("presentation:cycle-mode"),
  onPresentationModeChanged: (callback) =>
    ipcRenderer.on("presentation:mode-changed", (_event, mode) =>
      callback(mode),
    ),
  onPresentationActivity: (callback) =>
    ipcRenderer.on("presentation:activity", (_event, activity) =>
      callback(activity),
    ),
  moveLaser: (point) => ipcRenderer.send("laser:move", point),
  getLaserSettings: () => ipcRenderer.invoke("laser:get-settings"),
  setLaserSettings: (settings) =>
    ipcRenderer.invoke("laser:set-settings", settings),
  onLaserSettingsChanged: (callback) =>
    ipcRenderer.on("laser:settings-changed", (_event, settings) =>
      callback(settings),
    ),
  onLaserMoved: (callback) => ipcRenderer.on("laser:moved", () => callback()),
  getOverlayMode: () => ipcRenderer.invoke("overlay:get-mode"),
  setOverlayMode: (mode) => ipcRenderer.invoke("overlay:set-mode", mode),
  onOverlayMode: (callback) =>
    ipcRenderer.on("overlay:mode", (_event, mode) => callback(mode)),
  setOverlayColor: (color) => ipcRenderer.invoke("overlay:set-color", color),
  onOverlayColor: (callback) =>
    ipcRenderer.on("overlay:color", (_event, color) => callback(color)),
  getOverlayLayout: () => ipcRenderer.invoke("overlay:get-layout"),
  setOverlayScale: (scale) => ipcRenderer.invoke("overlay:set-scale", scale),
  setOverlayEditing: (editing) =>
    ipcRenderer.invoke("overlay:set-editing", editing),
  onOverlayEditing: (callback) =>
    ipcRenderer.on("overlay:editing", (_event, editing) => callback(editing)),
  sendOverlayTracking: (tracking) =>
    ipcRenderer.send("overlay:tracking", tracking),
  onOverlayTracking: (callback) =>
    ipcRenderer.on("overlay:tracking", (_event, tracking) =>
      callback(tracking),
    ),
  getMotionEnabled: () => ipcRenderer.invoke("motion:get"),
  setMotionEnabled: (enabled) => ipcRenderer.invoke("motion:set", enabled),
  toggleMotion: () => ipcRenderer.invoke("motion:toggle"),
  onMotionChanged: (callback) =>
    ipcRenderer.on("motion:changed", (_event, enabled) => callback(enabled)),
  getCameraEnabled: () => ipcRenderer.invoke("camera:get"),
  setCameraEnabled: (enabled) => ipcRenderer.invoke("camera:set", enabled),
  onCameraChanged: (callback) =>
    ipcRenderer.on("camera:changed", (_event, enabled) => callback(enabled)),
  getPermissions: () => ipcRenderer.invoke("system:permissions"),
  openPermissionSettings: (permission) =>
    ipcRenderer.invoke("system:open-permission", permission),
  getDisplays: () => ipcRenderer.invoke("display:list"),
  setDisplay: (id) => ipcRenderer.invoke("display:set", id),
  getCursorEnabled: () => ipcRenderer.invoke("cursor:get"),
  setCursorEnabled: (enabled) => ipcRenderer.invoke("cursor:set", enabled),
  toggleCursor: () => ipcRenderer.invoke("cursor:toggle"),
  moveCursor: (point) => ipcRenderer.send("cursor:move", point),
  clickCursor: () => ipcRenderer.send("cursor:click"),
  getCursorSensitivity: () => ipcRenderer.invoke("cursor:get-sensitivity"),
  setCursorSensitivity: (value) =>
    ipcRenderer.invoke("cursor:set-sensitivity", value),
  onCursorSensitivityChanged: (callback) =>
    ipcRenderer.on("cursor:sensitivity-changed", (_event, value) =>
      callback(value),
    ),
  onCursorChanged: (callback) =>
    ipcRenderer.on("cursor:changed", (_event, enabled) => callback(enabled)),
  getKeyboardVisible: () => ipcRenderer.invoke("keyboard:get"),
  setKeyboardVisible: (visible) => ipcRenderer.invoke("keyboard:set", visible),
  toggleKeyboard: () => ipcRenderer.invoke("keyboard:toggle"),
  getTypingSensitivity: () => ipcRenderer.invoke("keyboard:get-sensitivity"),
  setTypingSensitivity: (value) =>
    ipcRenderer.invoke("keyboard:set-sensitivity", value),
  onTypingSensitivityChanged: (callback) =>
    ipcRenderer.on("keyboard:sensitivity-changed", (_event, value) =>
      callback(value),
    ),
  typeKey: (key) => ipcRenderer.invoke("keyboard:type", key),
  sendKeyboardPointer: (sample) => ipcRenderer.send("keyboard:pointer", sample),
  onKeyboardPointer: (callback) =>
    ipcRenderer.on("keyboard:pointer", (_event, sample) => callback(sample)),
  sendKeyboardHands: (hands) => ipcRenderer.send("keyboard:hands", hands),
  onKeyboardHands: (callback) =>
    ipcRenderer.on("keyboard:hands", (_event, hands) => callback(hands)),
  onKeyboardChanged: (callback) =>
    ipcRenderer.on("keyboard:changed", (_event, visible) => callback(visible)),
});

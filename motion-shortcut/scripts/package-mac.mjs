import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(".");
const releaseDirectory = join(root, "release");
const stagingDirectory = join(root, ".package-staging");
const appName = "Flickey.app";
const appPath = join(releaseDirectory, appName);
const resourcesPath = join(appPath, "Contents", "Resources");
const plistPath = join(appPath, "Contents", "Info.plist");
const macOSPath = join(appPath, "Contents", "MacOS");
const version = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
).version;
const artifactBase = `Flickey-${version}-arm64`;
const localIdentity = "Motion Shortcut Local Code Signing";
let signingIdentity = "-";
try {
  const identities = execFileSync(
    "/usr/bin/security",
    ["find-identity", "-v", "-p", "codesigning"],
    { encoding: "utf8" },
  );
  if (identities.includes(`\"${localIdentity}\"`))
    signingIdentity = localIdentity;
} catch {
  // 인증서가 없는 Mac에서는 ad-hoc 서명으로 폴백한다.
}

rmSync(releaseDirectory, { recursive: true, force: true });
rmSync(stagingDirectory, { recursive: true, force: true });
mkdirSync(releaseDirectory, { recursive: true });
mkdirSync(stagingDirectory, { recursive: true });

cpSync(
  join(root, "node_modules", "electron", "dist", "Electron.app"),
  appPath,
  {
    recursive: true,
    verbatimSymlinks: true,
  },
);

const appSource = join(stagingDirectory, "app");
mkdirSync(appSource, { recursive: true });
cpSync(join(root, "dist"), join(appSource, "dist"), { recursive: true });
cpSync(join(root, "electron"), join(appSource, "electron"), {
  recursive: true,
});
cpSync(join(root, "package.json"), join(appSource, "package.json"));
rmSync(join(resourcesPath, "default_app.asar"), { force: true });
execFileSync(
  join(root, "node_modules", ".bin", "asar"),
  ["pack", appSource, join(resourcesPath, "app.asar")],
  { stdio: "inherit" },
);

mkdirSync(join(resourcesPath, "native"), { recursive: true });
cpSync(
  join(root, "build", "native", "motion-cursor-helper"),
  join(resourcesPath, "native", "motion-cursor-helper"),
);

const plistBuddy = "/usr/libexec/PlistBuddy";
const setPlist = (key, value, type = "string") => {
  try {
    execFileSync(plistBuddy, ["-c", `Set :${key} ${value}`, plistPath]);
  } catch {
    execFileSync(plistBuddy, ["-c", `Add :${key} ${type} ${value}`, plistPath]);
  }
};
renameSync(join(macOSPath, "Electron"), join(macOSPath, "Flickey"));
setPlist("CFBundleName", "Flickey");
setPlist("CFBundleDisplayName", "Flickey");
setPlist("CFBundleExecutable", "Flickey");
setPlist("CFBundleIdentifier", "com.motionshortcut.app");
setPlist("CFBundleShortVersionString", version);
setPlist("CFBundleVersion", version);
setPlist(
  "NSCameraUsageDescription",
  "발표자의 손동작을 인식하여 Flickey 발표 명령을 실행하기 위해 카메라를 사용합니다.",
);
setPlist(
  "NSAppleEventsUsageDescription",
  "사용자가 지정한 발표 탭과 슬라이드 앱을 제어하기 위해 자동화 권한을 사용합니다.",
);
setPlist("LSApplicationCategoryType", "public.app-category.utilities");

// app.asar와 Info.plist를 교체하면 Electron 원본 서명이 무효가 된다.
// 배포 앱 전체를 하나의 안정된 macOS 신원으로 다시 서명한다.
execFileSync(
  "/usr/bin/codesign",
  ["--force", "--deep", "--sign", signingIdentity, appPath],
  { stdio: "inherit" },
);
if (signingIdentity === "-") {
  execFileSync(
    "/usr/bin/codesign",
    [
      "--force",
      "--sign",
      "-",
      "--requirements",
      '=designated => identifier "com.motionshortcut.app"',
      appPath,
    ],
    { stdio: "inherit" },
  );
}
execFileSync(
  "/usr/bin/codesign",
  ["--verify", "--deep", "--strict", "--verbose=2", appPath],
  { stdio: "inherit" },
);

execFileSync(
  "/usr/bin/ditto",
  [
    "-c",
    "-k",
    "--sequesterRsrc",
    "--keepParent",
    appPath,
    join(releaseDirectory, `${artifactBase}.zip`),
  ],
  { stdio: "inherit" },
);

const dmgSource = join(stagingDirectory, "dmg");
mkdirSync(dmgSource, { recursive: true });
cpSync(appPath, join(dmgSource, appName), {
  recursive: true,
  verbatimSymlinks: true,
});
symlinkSync("/Applications", join(dmgSource, "Applications"));
writeFileSync(
  join(dmgSource, "처음 실행 안내.txt"),
  "Apple Silicon Mac 전용입니다.\n\n1. 앱을 Applications로 드래그합니다.\n2. 앱을 우클릭하고 ‘열기’를 선택합니다.\n3. 카메라 및 손쉬운 사용 권한을 허용합니다.\n4. 권한 변경 후 앱을 다시 실행합니다.\n",
);
let dmgCreated = false;
try {
  execFileSync(
    "/usr/bin/hdiutil",
    [
      "create",
      "-volname",
      `모션 단축키 ${version}`,
      "-srcfolder",
      dmgSource,
      "-ov",
      "-format",
      "UDZO",
      join(releaseDirectory, `${artifactBase}.dmg`),
    ],
    { stdio: "inherit" },
  );
  dmgCreated = true;
} catch {
  console.warn("DMG 생성은 건너뛰었습니다. Flickey.app과 ZIP은 정상 생성되었습니다.");
}

rmSync(stagingDirectory, { recursive: true, force: true });
if (dmgCreated)
  console.log(`Created ${join(releaseDirectory, `${artifactBase}.dmg`)}`);
console.log(`Created ${join(releaseDirectory, `${artifactBase}.zip`)}`);

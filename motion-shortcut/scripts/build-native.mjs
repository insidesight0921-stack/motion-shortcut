import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outputDirectory = resolve("build/native");
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
  // 다른 Mac에서는 ad-hoc 서명으로 패키징한다.
}
mkdirSync(outputDirectory, { recursive: true });
execFileSync(
  "/usr/bin/clang",
  [
    "-arch",
    "arm64",
    resolve("electron/cursor-helper.c"),
    "-framework",
    "ApplicationServices",
    "-framework",
    "Carbon",
    "-o",
    resolve(outputDirectory, "motion-cursor-helper"),
  ],
  { stdio: "inherit" },
);
execFileSync(
  "/usr/bin/codesign",
  [
    "--force",
    "--sign",
    signingIdentity,
    "--identifier",
    "com.motionshortcut.input-helper",
    resolve(outputDirectory, "motion-cursor-helper"),
  ],
  { stdio: "inherit" },
);

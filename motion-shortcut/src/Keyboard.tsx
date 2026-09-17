import { useEffect, useRef, useState } from "react";

const connections: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const rows = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const koreanLabels: Record<string, string> = {
  q: "ㅂ",
  w: "ㅈ",
  e: "ㄷ",
  r: "ㄱ",
  t: "ㅅ",
  y: "ㅛ",
  u: "ㅕ",
  i: "ㅑ",
  o: "ㅐ",
  p: "ㅔ",
  a: "ㅁ",
  s: "ㄴ",
  d: "ㅇ",
  f: "ㄹ",
  g: "ㅎ",
  h: "ㅗ",
  j: "ㅓ",
  k: "ㅏ",
  l: "ㅣ",
  z: "ㅋ",
  x: "ㅌ",
  c: "ㅊ",
  v: "ㅍ",
  b: "ㅠ",
  n: "ㅜ",
  m: "ㅡ",
};
const shiftedKoreanLabels: Record<string, string> = {
  q: "ㅃ",
  w: "ㅉ",
  e: "ㄸ",
  r: "ㄲ",
  t: "ㅆ",
  o: "ㅒ",
  p: "ㅖ",
};

type Handedness = "Left" | "Right";
type HandSample = {
  handedness: Handedness;
  landmarks: Array<{ x: number; y: number }>;
};
type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";
type FingerPointer = {
  id: string;
  hand: Handedness;
  finger: FingerName;
  x: number;
  y: number;
  key: string;
  pressing: boolean;
  offset: number;
};
type TapState = {
  restOffset: number;
  lastOffset: number;
  lastAt: number;
  hoverKey: string;
  hoverSince: number;
  minY: number;
  lastY: number;
  armed: boolean;
  cooldownUntil: number;
};

const fingers: Array<{ name: FingerName; tip: number; base: number }> = [
  { name: "thumb", tip: 4, base: 2 },
  { name: "index", tip: 8, base: 5 },
  { name: "middle", tip: 12, base: 9 },
  { name: "ring", tip: 16, base: 13 },
  { name: "pinky", tip: 20, base: 17 },
];

const calibrationSteps: Array<{
  finger: FingerName | null;
  label: string;
  instruction: string;
}> = [
  {
    finger: "index",
    label: "양손 검지",
    instruction: "아래로 2~3번 톡 눌러주세요.",
  },
  {
    finger: "middle",
    label: "양손 중지",
    instruction: "아래로 2~3번 톡 눌러주세요.",
  },
  {
    finger: "ring",
    label: "양손 약지",
    instruction: "아래로 2~3번 톡 눌러주세요.",
  },
  {
    finger: "pinky",
    label: "양손 새끼손가락",
    instruction: "아래로 2~3번 톡 눌러주세요.",
  },
  {
    finger: "thumb",
    label: "편한 쪽 엄지",
    instruction: "아래로 2~3번 톡 눌러주세요.",
  },
  {
    finger: null,
    label: "편안한 손 이동 범위",
    instruction: "양손을 타자 치듯 편하게 좌우로 움직여주세요.",
  },
];
type CalibrationProfile = Record<FingerName, number> & {
  keyboardWidth: number;
  learnedKeyCenters?: Record<string, { x: number; y: number }>;
};
type CalibrationRun = {
  step: number;
  startedAt: number;
  ranges: Record<string, { min: number; max: number }>;
  reachMinX: number;
  reachMaxX: number;
  profile: Partial<CalibrationProfile>;
};
type TrainingRun = {
  index: number;
  startedAt: number;
  samples: FingerPointer[];
  centers: Record<string, Array<{ x: number; y: number }>>;
};
const PROFILE_KEY = "motion-keyboard-calibration-v3";
const TRAINING_TEXT =
  "키스의 고유조건은 입술끼리 만나야 하고 특별한 기술은 필요치 않다 빠르게 쫓겨온 여우가 예쁜 새 옆을 맴돈다";
const TRAINING_BEAT_MS = 850;

export default function Keyboard() {
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const tapStatesRef = useRef<Record<string, TapState>>({});
  const lastTypedRef = useRef({ key: "", at: 0 });
  const calibrationRef = useRef<CalibrationRun | null>(null);
  const trainingRef = useRef<TrainingRun | null>(null);
  const typingSensitivityRef = useRef(0.35);
  const [shift, setShift] = useState(false);
  const [typedPreview, setTypedPreview] = useState("");
  const [inputStatus, setInputStatus] = useState("입력할 앱을 먼저 선택하세요");
  const [pointers, setPointers] = useState<FingerPointer[]>([]);
  const [profile, setProfile] = useState<CalibrationProfile | null>(() =>
    loadCalibrationProfile(),
  );
  const profileRef = useRef(profile);
  const [calibrationStep, setCalibrationStep] = useState(-1);
  const [trainingReady, setTrainingReady] = useState(false);
  const [trainingIndex, setTrainingIndex] = useState(-1);
  const [trainingComplete, setTrainingComplete] = useState(false);

  useEffect(() => {
    for (const pointer of pointers) {
      if (!pointer.pressing || !pointer.key) continue;
      document
        .querySelector<HTMLButtonElement>(
          `button[data-key="${CSS.escape(pointer.key)}"]`,
        )
        ?.click();
    }
  }, [pointers]);

  const isHovered = (key: string) =>
    pointers.some((pointer) => pointer.key === key);
  const isPressed = (key: string) =>
    pointers.some((pointer) => pointer.key === key && pointer.pressing);

  const type = async (key: string) => {
    const outputKey = shift && key.length === 1 ? key.toUpperCase() : key;
    const result = await window.motionAPI?.typeKey(outputKey);
    setInputStatus(
      result?.ok ? "컴퓨터로 전송됨" : (result?.error ?? "입력 전송 실패"),
    );
    setTypedPreview((current) => {
      if (key === "Backspace") return current.slice(0, -1);
      if (key === "Enter") return `${current}↵`.slice(-42);
      const previewKey = key === " " ? " " : getKoreanLabel(key, shift);
      return `${current}${previewKey}`.slice(-42);
    });
    if (shift && key.length === 1) setShift(false);
  };

  const startCalibration = () => {
    trainingRef.current = null;
    setTrainingReady(false);
    setTrainingIndex(-1);
    setTrainingComplete(false);
    tapStatesRef.current = {};
    calibrationRef.current = {
      step: 0,
      startedAt: performance.now(),
      ranges: {},
      reachMinX: Infinity,
      reachMaxX: -Infinity,
      profile: {},
    };
    setCalibrationStep(0);
  };

  const startTraining = () => {
    if (!profileRef.current) {
      startCalibration();
      return;
    }
    tapStatesRef.current = {};
    trainingRef.current = {
      index: 0,
      startedAt: performance.now(),
      samples: [],
      centers: {},
    };
    setTrainingComplete(false);
    setTrainingReady(false);
    setTrainingIndex(0);
  };

  function updateTraining(nextPointers: FingerPointer[]) {
    const run = trainingRef.current;
    if (!run) return;
    const expected = TRAINING_KEYS[run.index];
    const assignment = fingerForKey(expected);
    const elapsed = performance.now() - run.startedAt;

    // 박자의 앞부분은 손가락을 준비하는 시간으로 두고, 후반 눌림만 학습한다.
    if (elapsed > TRAINING_BEAT_MS * 0.38) {
      run.samples.push(
        ...nextPointers.filter(
          (pointer) =>
            pointer.finger === assignment.finger &&
            (assignment.hand === null || pointer.hand === assignment.hand),
        ),
      );
    }
    if (elapsed < TRAINING_BEAT_MS) return;

    if (run.samples.length) {
      const peak = run.samples.reduce((best, sample) =>
        sample.offset > best.offset ? sample : best,
      );
      const key = expected.toLowerCase();
      (run.centers[key] ??= []).push({
        x: peak.x / window.innerWidth,
        y: peak.y / window.innerHeight,
      });
    }

    run.index += 1;
    run.startedAt = performance.now();
    run.samples = [];
    if (run.index < TRAINING_KEYS.length) {
      setTrainingIndex(run.index);
      return;
    }

    const learnedKeyCenters = Object.fromEntries(
      Object.entries(run.centers).map(([key, points]) => [
        key,
        {
          x: median(points.map((point) => point.x)),
          y: median(points.map((point) => point.y)),
        },
      ]),
    );
    const completed = { ...profileRef.current!, learnedKeyCenters };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(completed));
    profileRef.current = completed;
    setProfile(completed);
    trainingRef.current = null;
    tapStatesRef.current = {};
    setTrainingIndex(-1);
    setTrainingComplete(true);
  }

  function updateCalibration(nextPointers: FingerPointer[]) {
    const run = calibrationRef.current;
    if (!run) return;
    const target = calibrationSteps[run.step];
    for (const pointer of nextPointers) {
      if (target.finger === null) {
        if (pointer.finger !== "thumb") {
          run.reachMinX = Math.min(run.reachMinX, pointer.x);
          run.reachMaxX = Math.max(run.reachMaxX, pointer.x);
        }
        continue;
      }
      if (pointer.finger !== target.finger) continue;
      const range = run.ranges[pointer.id] ?? {
        min: pointer.offset,
        max: pointer.offset,
      };
      range.min = Math.min(range.min, pointer.offset);
      range.max = Math.max(range.max, pointer.offset);
      run.ranges[pointer.id] = range;
    }
    if (performance.now() - run.startedAt < (target.finger ? 2600 : 3400))
      return;

    if (target.finger) {
      const measuredRanges = Object.values(run.ranges)
        .map((range) => range.max - range.min)
        .filter((range) => range > 0.015);
      const measuredRange = measuredRanges.length
        ? measuredRanges.reduce((sum, range) => sum + range, 0) /
          measuredRanges.length
        : 0.16;
      run.profile[target.finger] = clamp(measuredRange * 0.38, 0.04, 0.13);
    } else {
      const reach = Number.isFinite(run.reachMinX)
        ? run.reachMaxX - run.reachMinX
        : 520;
      run.profile.keyboardWidth = clamp(reach * 1.08, 360, 720);
    }
    run.step += 1;
    if (run.step < calibrationSteps.length) {
      run.startedAt = performance.now();
      run.ranges = {};
      setCalibrationStep(run.step);
      return;
    }

    const completed = run.profile as CalibrationProfile;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(completed));
    calibrationRef.current = null;
    tapStatesRef.current = {};
    profileRef.current = completed;
    setProfile(completed);
    setCalibrationStep(-1);
    setTrainingReady(true);
  }

  useEffect(() => {
    void window.motionAPI?.getTypingSensitivity?.().then((value) => {
      typingSensitivityRef.current = value;
    });
    window.motionAPI?.onTypingSensitivityChanged?.((value) => {
      typingSensitivityRef.current = value;
    });
    window.motionAPI?.onKeyboardHands((hands) => {
      drawKeyboardHands(handCanvasRef.current, hands);
      const nextPointers = trackFingerTaps(
        hands,
        tapStatesRef.current,
        lastTypedRef.current,
        profileRef.current,
        calibrationRef.current !== null || trainingRef.current !== null,
        typingSensitivityRef.current,
      );
      updateCalibration(nextPointers);
      updateTraining(nextPointers);
      setPointers(nextPointers);
    });
  }, []);

  return (
    <main
      className={`virtual-keyboard ${profile ? "calibrated" : "needs-calibration"}`}
      aria-label="모션 가상 키보드"
    >
      <header>
        <span>모션 키보드</span>
        <small>두벌식 한글 입력 · 먼저 입력할 앱에서 커서를 둔 뒤 사용</small>
        <output className="typing-preview">
          {typedPreview || "입력 테스트…"}
        </output>
        <em className={inputStatus === "컴퓨터로 전송됨" ? "ok" : ""}>
          {inputStatus}
        </em>
        <button
          onClick={() => void window.motionAPI?.setKeyboardVisible(false)}
        >
          닫기
        </button>
        <button className="calibrate-button" onClick={startCalibration}>
          다시 보정
        </button>
        <button className="train-button" onClick={startTraining}>
          문장 학습
        </button>
      </header>
      <div
        className="keyboard-surface"
        style={{ width: profile?.keyboardWidth ?? 720 }}
      >
        {rows.map((row, rowIndex) => (
          <div className="keyboard-row" key={rowIndex}>
            {row.map((key) => (
              <button
                key={key}
                data-key={key}
                className={`${isHovered(key) ? "air-hover" : ""} ${isPressed(key) ? "air-pressed" : ""}`}
                onClick={() => type(key)}
              >
                {getKoreanLabel(key, shift)}
              </button>
            ))}
          </div>
        ))}
        <div className="keyboard-row controls">
          <button
            data-key="Shift"
            className={`${shift ? "active" : ""} ${isHovered("Shift") ? "air-hover" : ""}`}
            onClick={() => setShift(!shift)}
          >
            Shift
          </button>
          <button
            data-key="Space"
            className={`space ${isHovered("Space") ? "air-hover" : ""} ${isPressed("Space") ? "air-pressed" : ""}`}
            onClick={() => type(" ")}
          >
            Space
          </button>
          <button
            data-key="Backspace"
            className={isHovered("Backspace") ? "air-hover" : ""}
            onClick={() => type("Backspace")}
          >
            ⌫
          </button>
          <button
            data-key="Enter"
            className={isHovered("Enter") ? "air-hover" : ""}
            onClick={() => type("Enter")}
          >
            Enter
          </button>
        </div>
      </div>
      <canvas ref={handCanvasRef} className="keyboard-hands" />
      {pointers.map((pointer) => (
        <i
          key={pointer.id}
          className={`finger-pointer ${pointer.hand.toLowerCase()} ${pointer.finger} ${pointer.pressing ? "pressing" : ""}`}
          style={{ left: pointer.x, top: pointer.y }}
          aria-hidden="true"
        />
      ))}
      {!profile && calibrationStep < 0 && (
        <section className="calibration-panel">
          <strong>내 손에 맞추기</strong>
          <p>손가락별 눌림 깊이를 측정하면 투명 키보드가 열립니다.</p>
          <button onClick={startCalibration}>손가락 보정 시작</button>
        </section>
      )}
      {calibrationStep >= 0 && (
        <section className="calibration-panel active">
          <small>
            {calibrationStep + 1} / {calibrationSteps.length}
          </small>
          <strong>{calibrationSteps[calibrationStep].label}</strong>
          <p>{calibrationSteps[calibrationStep].instruction}</p>
          <i key={calibrationStep} className="calibration-progress" />
        </section>
      )}
      {trainingReady && (
        <section className="training-panel training-intro">
          <small>마지막 단계 · 개인 타건 학습</small>
          <strong>화면의 박자에 맞춰 허공에 자연스럽게 타자 치기</strong>
          <p className="training-copy">{TRAINING_TEXT}</p>
          <span>
            키보드 위치에 손을 억지로 맞추지 마세요. 평소 타자 치는 자리에서
            표시되는 키만 한 번씩 누르면 됩니다.
          </span>
          <button onClick={startTraining}>문장 학습 시작</button>
        </section>
      )}
      {trainingIndex >= 0 && (
        <section className="training-panel">
          <small>
            개인 타건 학습 · {trainingIndex + 1} / {TRAINING_KEYS.length}
          </small>
          <p className="training-copy">{TRAINING_TEXT}</p>
          <span>박자에 맞춰 지금 이 키를 자연스럽게 톡 누르세요</span>
          <strong className="training-key" key={trainingIndex}>
            {trainingKeyLabel(TRAINING_KEYS[trainingIndex])}
          </strong>
          <i className="training-progress">
            <b
              style={{
                width: `${((trainingIndex + 1) / TRAINING_KEYS.length) * 100}%`,
              }}
            />
          </i>
          <button
            onClick={() => {
              trainingRef.current = null;
              setTrainingIndex(-1);
            }}
          >
            학습 취소
          </button>
        </section>
      )}
      {trainingComplete && (
        <section className="training-toast">
          개인 타건 위치 학습 완료
          <button onClick={() => setTrainingComplete(false)}>확인</button>
        </section>
      )}
    </main>
  );
}

function getKoreanLabel(key: string, shift: boolean) {
  if (shift && shiftedKoreanLabels[key]) return shiftedKoreanLabels[key];
  return koreanLabels[key] ?? key;
}

function trackFingerTaps(
  hands: HandSample[],
  states: Record<string, TapState>,
  lastTyped: { key: string; at: number },
  profile: CalibrationProfile | null,
  calibrating: boolean,
  sensitivity: number,
) {
  const now = performance.now();
  const visible = new Set<string>();
  const pointers: FingerPointer[] = [];

  for (const hand of hands) {
    if (hand.landmarks.length < 21) continue;
    const palmScale = Math.max(
      distance(hand.landmarks[0], hand.landmarks[9]),
      0.04,
    );

    for (const finger of fingers) {
      const id = `${hand.handedness}-${finger.name}`;
      visible.add(id);
      const tip = hand.landmarks[finger.tip];
      const base = hand.landmarks[finger.base];
      const x = tip.x * window.innerWidth;
      const y = tip.y * window.innerHeight;
      const button = document
        .elementFromPoint(x, y)
        ?.closest<HTMLButtonElement>("button[data-key]");
      const learnedKey = nearestLearnedKey(
        x,
        y,
        hand.handedness,
        finger.name,
        profile?.learnedKeyCenters,
      );
      let key = learnedKey ?? button?.dataset.key ?? "";
      const isThumb = finger.name === "thumb";
      if (isThumb && key !== "Space") key = "";

      // 손 전체 이동이 아닌 손바닥 관절에 대한 손끝의 상대 이동으로 타건한다.
      const offset = (tip.y - base.y) / palmScale;
      const state = states[id] ?? {
        restOffset: offset,
        lastOffset: offset,
        lastAt: now,
        hoverKey: key,
        hoverSince: now,
        minY: y,
        lastY: y,
        armed: true,
        cooldownUntil: 0,
      };
      const elapsed = Math.max(now - state.lastAt, 1);
      const downwardSpeed = (offset - state.lastOffset) / elapsed;
      const screenDownwardSpeed = (y - state.lastY) / elapsed;
      const pressDistance = Math.min(
        (profile?.[finger.name] ?? (isThumb ? 0.17 : 0.2)) *
          (2.5 - sensitivity),
        0.3,
      );
      const releaseDistance = pressDistance * 0.48;

      if (key !== state.hoverKey) {
        state.hoverKey = key;
        state.hoverSince = now;
        state.minY = y;
      } else if (state.armed) {
        state.minY = Math.min(state.minY, y);
      }

      if (offset < state.restOffset) state.restOffset = offset;
      else if (state.armed) {
        state.restOffset += (offset - state.restOffset) * 0.025;
      }
      if (
        !state.armed &&
        (offset < state.restOffset + releaseDistance || state.lastY - y > 5)
      ) {
        state.armed = true;
        state.minY = y;
      }

      const relativeTap =
        offset > state.restOffset + pressDistance && downwardSpeed > 0.0002;
      const screenTap =
        now - state.hoverSince > 390 - sensitivity * 180 &&
        y - state.minY > 54 - sensitivity * 34 &&
        screenDownwardSpeed > 0.085 - sensitivity * 0.04;
      let pressing =
        !calibrating &&
        Boolean(key) &&
        state.armed &&
        now >= state.cooldownUntil &&
        (relativeTap || screenTap);

      // 같은 키를 여러 손가락이 동시에 건드려도 한 글자만 입력한다.
      if (
        pressing &&
        lastTyped.key === key &&
        now - lastTyped.at < 650 - sensitivity * 260
      ) {
        pressing = false;
      }
      if (pressing) {
        state.armed = false;
        state.cooldownUntil = now + 780 - sensitivity * 300;
        lastTyped.key = key;
        lastTyped.at = now;
      }

      state.lastOffset = offset;
      state.lastAt = now;
      state.lastY = y;
      states[id] = state;
      pointers.push({
        id,
        hand: hand.handedness,
        finger: finger.name,
        x,
        y,
        key,
        pressing,
        offset,
      });
    }
  }

  for (const id of Object.keys(states)) {
    if (!visible.has(id)) delete states[id];
  }
  return pointers;
}

function loadCalibrationProfile(): CalibrationProfile | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null");
    if (
      parsed &&
      calibrationSteps.every(
        ({ finger }) => finger === null || Number.isFinite(parsed[finger]),
      ) &&
      Number.isFinite(parsed.keyboardWidth)
    ) {
      return parsed as CalibrationProfile;
    }
  } catch {
    // 손상된 이전 설정은 무시하고 다시 보정한다.
  }
  return null;
}

const initialKeys = [
  "r",
  "R",
  "s",
  "e",
  "E",
  "f",
  "a",
  "q",
  "Q",
  "t",
  "T",
  "d",
  "w",
  "W",
  "c",
  "z",
  "x",
  "v",
  "g",
];
const medialKeys = [
  "k",
  "o",
  "i",
  "O",
  "j",
  "p",
  "u",
  "P",
  "h",
  "hk",
  "ho",
  "hl",
  "y",
  "n",
  "nj",
  "np",
  "nl",
  "b",
  "m",
  "ml",
  "l",
];
const finalKeys = [
  "",
  "r",
  "R",
  "rt",
  "s",
  "sw",
  "sg",
  "e",
  "f",
  "fr",
  "fa",
  "fq",
  "ft",
  "fx",
  "fv",
  "fg",
  "a",
  "q",
  "qt",
  "t",
  "T",
  "d",
  "w",
  "c",
  "z",
  "x",
  "v",
  "g",
];
const TRAINING_KEYS = hangulToKeyboardKeys(TRAINING_TEXT);

function hangulToKeyboardKeys(text: string) {
  const keys: string[] = [];
  for (const character of text) {
    if (character === " ") {
      keys.push(" ");
      continue;
    }
    const syllable = character.charCodeAt(0) - 0xac00;
    if (syllable < 0 || syllable > 11171) continue;
    const initial = Math.floor(syllable / 588);
    const medial = Math.floor((syllable % 588) / 28);
    const final = syllable % 28;
    keys.push(
      ...initialKeys[initial],
      ...medialKeys[medial],
      ...finalKeys[final],
    );
  }
  return keys;
}

function fingerForKey(key: string): {
  hand: Handedness | null;
  finger: FingerName;
} {
  const normalized = key.toLowerCase();
  if (normalized === " ") return { hand: null, finger: "thumb" };
  if ("qaz".includes(normalized)) return { hand: "Left", finger: "pinky" };
  if ("wsx".includes(normalized)) return { hand: "Left", finger: "ring" };
  if ("edc".includes(normalized)) return { hand: "Left", finger: "middle" };
  if ("rfvtgb".includes(normalized)) return { hand: "Left", finger: "index" };
  if ("yhnujm".includes(normalized)) return { hand: "Right", finger: "index" };
  if ("ik".includes(normalized)) return { hand: "Right", finger: "middle" };
  if ("ol".includes(normalized)) return { hand: "Right", finger: "ring" };
  return { hand: "Right", finger: "pinky" };
}

function nearestLearnedKey(
  x: number,
  y: number,
  hand: Handedness,
  finger: FingerName,
  centers?: Record<string, { x: number; y: number }>,
) {
  if (!centers || !Object.keys(centers).length) return null;
  let nearest: { key: string; distance: number } | null = null;
  for (const [key, center] of Object.entries(centers)) {
    const assignment = fingerForKey(key);
    if (
      assignment.finger !== finger ||
      (assignment.hand !== null && assignment.hand !== hand)
    )
      continue;
    const distance = Math.hypot(
      x / window.innerWidth - center.x,
      y / window.innerHeight - center.y,
    );
    if (!nearest || distance < nearest.distance) nearest = { key, distance };
  }
  return nearest?.key ?? null;
}

function trainingKeyLabel(key: string) {
  if (key === " ") return "SPACE";
  const normalized = key.toLowerCase();
  return `${getKoreanLabel(normalized, key !== normalized)} · ${key.toUpperCase()}`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function drawKeyboardHands(
  canvas: HTMLCanvasElement | null,
  hands: HandSample[],
) {
  if (!canvas) return;
  const scale = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width * scale || canvas.height !== height * scale) {
    canvas.width = width * scale;
    canvas.height = height * scale;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);
  for (const hand of hands) {
    const color = hand.handedness === "Left" ? "#65f6dc" : "#78b5ff";
    const point = (index: number) => ({
      x: hand.landmarks[index].x * width,
      y: hand.landmarks[index].y * height,
    });
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineCap = "round";
    context.lineWidth = 3;
    context.globalAlpha = 0.72;
    context.shadowColor = color;
    context.shadowBlur = 14;
    for (const [from, to] of connections) {
      const a = point(from);
      const b = point(to);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    hand.landmarks.forEach((_landmark, index) => {
      const p = point(index);
      context.beginPath();
      context.arc(
        p.x,
        p.y,
        [4, 8, 12, 16, 20].includes(index) ? 6 : 3,
        0,
        Math.PI * 2,
      );
      context.fill();
    });
    context.restore();
  }
}

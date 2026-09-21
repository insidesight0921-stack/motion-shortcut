import { useEffect, useState } from "react";
import { ArticulatedHand as Hand } from "./ArticulatedHand";
import { VIEWBOX } from "./tutorialViewBox";

const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const blend = (a: number[], b: number[], t: number) =>
  a.map((v, i) => v + (b[i] - v) * t);
const open = [0, 0, 0, 0, 0];
const fist = [1, 1, 1, 1, 1];
const phone = [0, 1, 1, 1, 0];
const index = [1, 0, 1, 1, 1];
const lPose = [0, 0, 1, 1, 1];
const three = [1, 0, 0, 0, 1];

function Laptop({
  lit,
  pointer = false,
  click = false,
}: {
  lit: boolean;
  pointer?: boolean;
  click?: boolean;
}) {
  return (
    <g>
      <rect
        x="260"
        y="52"
        width="280"
        height="168"
        rx="10"
        fill="#18121f"
        stroke="#857195"
        strokeWidth="2"
      />
      <rect
        x="272"
        y="64"
        width="256"
        height="144"
        rx="3"
        fill={lit ? "#39284e" : "#050508"}
      />
      {lit && (
        <g fill="#c5a0ff">
          <rect x="292" y="84" width="85" height="5" rx="2" />
          <rect x="292" y="103" width="145" height="3" opacity=".5" />
          <rect x="292" y="121" width="110" height="3" opacity=".5" />
          <text x="292" y="176" fontSize="22">
            ADAM
          </text>
        </g>
      )}
      <path d="M248 222 H552 L570 235 H230 Z" fill="#292131" stroke="#857195" />
      {pointer && (
        <g transform="translate(453 148)">
          <path
            d="M0 0 L0 29 L8 21 L15 34 L21 31 L14 18 L25 18 Z"
            fill="#f1e6ff"
            stroke="#9b73c5"
          />
          {click && (
            <circle r="30" fill="none" stroke="#dabaff" strokeWidth="2" />
          )}
        </g>
      )}
    </g>
  );
}
export function TutorialMotion({ slide }: { slide: number }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = 0,
      elapsed = 0,
      painted = 0;
    const tick = (now: number) => {
      if (last) elapsed += Math.min(now - last, 50);
      last = now;
      // Thirty frames per second is enough for this instructional motion.
      if (now - painted >= 1000 / 30) {
        setT((elapsed % 8000) / 8000);
        painted = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (media?.matches) setT(0.55);
      else if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    media?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      media?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [slide]);
  // Separate deliberate swipes with a hold at each end; never wave the wrist.
  const swipe = smooth((t - 0.15) / 0.13) - smooth((t - 0.62) / 0.13);
  const close = smooth((t - 0.12) / 0.18) * (1 - smooth((t - 0.82) / 0.16));
  // Leave the camera view before showing the palm again to toggle the screen back on.
  const palmOpacity = 1 - smooth((t - 0.32) / 0.10) + smooth((t - 0.54) / 0.10);
  const screenHidden = t >= 0.22 && t < 0.76;
  const resume = smooth((t - 0.52) / 0.18);
  const labels = [
    "손날을 카메라 쪽으로 세우고 오른쪽, 왼쪽으로 밀어 넘기기",
    "손바닥을 유지해 화면을 가린 뒤 손이 사라졌다가 다시 펼친 손으로 나타나 화면 복원",
    "L자로 포인터 전환, 오른손 검지와 왼손 주먹으로 클릭, 세 손가락으로 슬라이드 복귀",
    "양손 주먹으로 정지한 뒤 오른손을 전화기 모양으로 펼쳐 재개",
    "한 손을 천천히 주먹 쥐어 발표 종료",
  ];
  return (
    <div className="tutorial-motion">
      <svg
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        role="img"
        aria-label={labels[slide - 1]}
      >
        {slide === 1 && (
          <>
            <path
              d="M200 140 H270 M200 140 l14 -12 M200 140 l14 12 M530 140 H600 M600 140 l-14 -12 M600 140 l-14 12"
              stroke="#ad8ccc"
              fill="none"
            />
            <text x="215" y="280">
              이전
            </text>
            <text x="550" y="280">
              다음
            </text>
          </>
        )}
        {slide === 2 && (
          <>
            <Laptop lit={!screenHidden} />
            <text x="400" y="282" textAnchor="middle">
              {t < 0.22 ? "손바닥 유지 · 화면 가리기"
                : t < 0.32 ? "화면이 가려졌습니다"
                : t < 0.54 ? "손을 카메라 밖으로 잠시 내려주세요"
                : t < 0.76 ? "손바닥을 펼쳐 다시 보여주세요"
                : "화면이 다시 켜졌습니다"}
            </text>
          </>
        )}
        {slide === 3 && (
          <>
            <g transform="translate(-110 0) scale(.85)">
              <Laptop lit pointer={t > 0.38} click={t > 0.68 && t < 0.82} />
            </g>
            <path d="M470 28 V275" stroke="#584363" />
            <text x="625" y="280" textAnchor="middle">
              슬라이드 모드
            </text>
          </>
        )}
        {slide === 4 && (
          <text x="400" y="285" textAnchor="middle">
            {t < 0.52 ? "양손 주먹 · 모션 정지" : "엄지 + 새끼손가락 · 재개"}
          </text>
        )}
      </svg>
      {/* Hands are HTML canvases layered over the svg (no foreignObject — WebKit
          mispositions and stops repainting it); x/y/scale are viewBox units. */}
      <div className="tutorial-hands" aria-hidden="true">
        {slide === 1 && (
          <Hand
            pose={[0, 0.025, 0.035, 0.045, 0.055]}
            x={320 + swipe * 160}
            y={165}
            angle={8}
            edgeOn
          />
        )}
        {slide === 2 && (
          <Hand pose={open} x={180} y={190} scale={0.8} opacity={palmOpacity} />
        )}
        {slide === 3 && (
          <>
            {/* The laptop group's translate(-110 0) scale(.85) is applied to
                these two hands' coordinates directly. */}
            <Hand
              pose={blend(lPose, index, smooth((t - 0.44) / 0.12))}
              x={-110 + 545 * 0.85}
              y={265 * 0.85}
              scale={0.55 * 0.85}
              backFacing
              left
            />
            <Hand
              pose={blend(
                open,
                fist,
                smooth((t - 0.6) / 0.08) * (1 - smooth((t - 0.82) / 0.12)),
              )}
              x={-110 + 260 * 0.85}
              y={265 * 0.85}
              scale={0.55 * 0.85}
              backFacing
              opacity={smooth((t - 0.56) / 0.04)}
            />
            <Hand
              pose={blend(fist, three, close)}
              x={635}
              y={170}
              scale={0.85}
            />
          </>
        )}
        {slide === 4 && (
          <>
            <Hand
              pose={blend(open, fist, close)}
              x={290}
              y={170}
              scale={0.85}
              left
              opacity={1 - resume * 0.85}
            />
            <Hand
              pose={blend(blend(open, fist, close), phone, resume)}
              x={500}
              y={170}
              scale={0.85}
            />
          </>
        )}
        {slide === 5 && (
          <Hand pose={blend(open, fist, close)} x={400} y={150} scale={1.2} />
        )}
      </div>
    </div>
  );
}

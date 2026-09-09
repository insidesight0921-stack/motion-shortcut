import type { SVGProps } from 'react';

/**
 * 인라인 SVG 아이콘 (24px). 색은 currentColor — 부모에서 brand-accent 또는 icon-subtle 토큰을 준다.
 * 이모지 아이콘 금지 (docs/DESIGN.md §8).
 */
type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...rest }: IconProps) {
  return (
    <svg
      className="icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function IconSoundOn(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
      <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
    </Svg>
  );
}

export function IconSoundOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
      <path d="M16 9.5l5 5" />
      <path d="M21 9.5l-5 5" />
    </Svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="M16 10.5l5-2.5v8l-5-2.5" />
    </Svg>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0" />
      <circle cx="15.5" cy="7" r="1.8" />
      <circle cx="8.5" cy="12" r="1.8" />
      <circle cx="17.5" cy="17" r="1.8" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

/* ---- 제스처 아이콘 (매핑 편집기) ---- */

export function IconGestureOpenPalm(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 11V5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M17 13l1.5-2a1.4 1.4 0 0 1 2.3 1.6L18 17.5a6 6 0 0 1-5.5 3.5H12A5 5 0 0 1 7 16v-4a1.5 1.5 0 0 1 3 0v1" />
    </Svg>
  );
}

export function IconGestureFist(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="9" width="12" height="10" rx="3" />
      <path d="M9 9V7.5a1.5 1.5 0 0 1 3 0V9M12 9V7a1.5 1.5 0 0 1 3 0v2M6 13H4.5a1.5 1.5 0 0 0 0 3H6" />
    </Svg>
  );
}

export function IconGestureSwipeRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h14" />
      <path d="M13 7l5 5-5 5" />
    </Svg>
  );
}

export function IconGestureSwipeLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12H6" />
      <path d="M11 7l-5 5 5 5" />
    </Svg>
  );
}

export function IconGestureCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4a8 8 0 1 1-7.5 5.2" />
      <path d="M4.5 4.5v5h5" />
    </Svg>
  );
}

/** 상태 점. 색은 부모의 currentColor */
export function StatusDot({ className = '' }: { className?: string }) {
  return <span className={`status-dot ${className}`} aria-hidden />;
}

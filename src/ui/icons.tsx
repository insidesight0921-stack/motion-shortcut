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

/** 상태 점. 색은 부모의 currentColor */
export function StatusDot({ className = '' }: { className?: string }) {
  return <span className={`status-dot ${className}`} aria-hidden />;
}

'use client';

// ============================================================================
// src/components/motion/success-tick.tsx — the confirmation mark.
//
// Rebuilt from design/reference/success.svg. Draws once on mount rather than
// looping: a tick that keeps re-drawing reads as "still working", which is the
// opposite of what it means.
//
// Uses the `validated / positive` token — DESIGN.md gives each accent exactly
// one meaning, and this is the only thing green is for.
// ============================================================================

export interface SuccessTickProps {
  size?: number;
  /** Announced to screen readers. Omit for a tick beside text that says it. */
  label?: string;
  className?: string;
}

const CIRCLE_LENGTH = 2 * Math.PI * 21;
const CHECK_LENGTH = 26;

export function SuccessTick({ size = 48, label, className }: SuccessTickProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="24" cy="24" r="21" fill="var(--positive-wash)" />
      <circle
        className="wb-tick-ring"
        cx="24"
        cy="24"
        r="21"
        stroke="var(--positive)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={CIRCLE_LENGTH}
        transform="rotate(-90 24 24)"
      />
      <path
        className="wb-tick-check"
        d="M15 24.5 L21.5 31 L33 19"
        stroke="var(--positive-text)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={CHECK_LENGTH}
      />
    </svg>
  );
}

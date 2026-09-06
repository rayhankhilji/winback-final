'use client';

// ============================================================================
// src/components/motion/menu-button.tsx — hamburger ⇄ close.
//
// Rebuilt from design/reference/Menu Button.svg. That reference loops on a
// 3.5s timer, which is right for a showcase and wrong for a control: a menu
// button must be driven by whether the menu is actually open, or it is
// animating a lie. Same ±45° gesture, same easing feel, bound to state.
// ============================================================================

const BAR = {
  position: 'absolute' as const,
  left: 0,
  width: '100%',
  height: 2,
  borderRadius: 2,
  background: 'currentColor',
  transition:
    'transform 220ms var(--ease-standard), opacity 150ms var(--ease-standard)',
};

export interface MenuButtonProps {
  open: boolean;
  onToggle: () => void;
  /** Width/height of the bar stack in px. */
  size?: number;
  /** Names the control for screen readers; the state is announced separately. */
  label?: string;
  className?: string;
}

export function MenuButton({
  open,
  onToggle,
  size = 20,
  label = 'Menu',
  className,
}: MenuButtonProps) {
  const gap = Math.round(size * 0.3);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={label}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 16,
        height: size + 16,
        padding: 8,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      <span
        style={{ position: 'relative', display: 'block', width: size, height: size }}
        aria-hidden="true"
      >
        <span
          style={{
            ...BAR,
            top: `calc(50% - 1px - ${gap}px)`,
            transform: open ? `translateY(${gap}px) rotate(45deg)` : 'none',
          }}
        />
        {/* The middle bar fades rather than rotating: three bars converging on
            an X leaves a visible third stroke. */}
        <span
          style={{
            ...BAR,
            top: 'calc(50% - 1px)',
            opacity: open ? 0 : 1,
            transform: open ? 'scaleX(0.4)' : 'none',
          }}
        />
        <span
          style={{
            ...BAR,
            top: `calc(50% - 1px + ${gap}px)`,
            transform: open ? `translateY(-${gap}px) rotate(-45deg)` : 'none',
          }}
        />
      </span>
    </button>
  );
}

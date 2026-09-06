'use client';

// ============================================================================
// src/components/settings/integration-card.tsx
//
// One integration. Logo, name, tag, a switch, a sentence, and a footer action
// — the shape from the reference design.
//
// The switch is the real control and is optimistic-free: it flips only after
// the caller says it did, because a toggle that snaps back is worse than one
// that takes a moment.
// ============================================================================

import { useState } from 'react';
import { BookOpen, SlidersHorizontal } from 'lucide-react';
import type { Integration } from '@/lib/integrations/catalog';
import { logoUrl, monogram } from '@/lib/integrations/logo';

export interface IntegrationCardProps {
  integration: Integration;
  connected: boolean;
  onToggle: (id: string, next: boolean) => void;
}

function Logo({ integration }: { integration: Integration }) {
  const src = logoUrl(integration.domain, 64);
  const [failed, setFailed] = useState(false);

  const base = {
    width: 32,
    height: 32,
    borderRadius: 8,
    flexShrink: 0,
  } as const;

  // No token configured, or the CDN did not answer: a monogram tile, not a
  // broken image. See src/lib/integrations/logo.ts for why this one degrades.
  if (!src || failed) {
    return (
      <span
        style={{
          ...base,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-sunken)',
          border: '1px solid var(--hairline)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}
        aria-hidden="true"
      >
        {monogram(integration.name)}
      </span>
    );
  }

  return (
    // Not next/image: these are third-party CDN logos at a fixed 32px, so the
    // optimiser buys nothing and would need every domain allow-listed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={32}
      height={32}
      style={{ ...base, objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  );
}

function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 38,
        height: 22,
        flexShrink: 0,
        padding: 2,
        borderRadius: 999,
        border: '1px solid ' + (checked ? 'var(--positive)' : 'var(--hairline)'),
        background: checked ? 'var(--positive)' : 'var(--surface-sunken)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 150ms var(--ease-standard), border-color 150ms var(--ease-standard)',
      }}
    >
      <span
        style={{
          display: 'block',
          width: 16,
          height: 16,
          borderRadius: 999,
          background: 'var(--surface-card)',
          boxShadow: '0 1px 2px rgb(31 30 28 / 0.2)',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 150ms var(--ease-standard)',
        }}
      />
    </button>
  );
}

export function IntegrationCard({ integration, connected, onToggle }: IntegrationCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        border: '1px solid var(--hairline)',
        background: 'var(--surface-card)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 16, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo integration={integration} />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-display)' }}>
            {integration.name}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 11,
              background: 'var(--interactive-wash)',
              color: 'var(--interactive-text)',
              whiteSpace: 'nowrap',
            }}
          >
            {integration.tag}
          </span>

          <span style={{ marginLeft: 'auto' }}>
            <Switch
              checked={connected}
              disabled={!integration.available}
              label={`Connect ${integration.name}`}
              onChange={() => onToggle(integration.id, !connected)}
            />
          </span>
        </div>

        <p
          style={{
            margin: '12px 0 0',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          {integration.description}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '10px 16px',
          borderTop: '1px solid var(--hairline)',
          background: 'var(--surface-canvas)',
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}
      >
        {integration.available ? (
          <>
            <SlidersHorizontal size={14} aria-hidden="true" />
            Configure integration
          </>
        ) : (
          <>
            <BookOpen size={14} aria-hidden="true" />
            Coming soon
          </>
        )}
      </div>
    </div>
  );
}

'use client';

// ============================================================================
// /settings/integrations
//
// Every place Winback can read documents from, grouped by what that place
// actually is. Connection state is local for now — there is no OAuth backend
// behind these switches yet, and the page says so rather than pretending.
// ============================================================================

import { useState } from 'react';
import { CATEGORY_ORDER, INTEGRATIONS } from '@/lib/integrations/catalog';
import { IntegrationCard } from '@/components/settings/integration-card';

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(INTEGRATIONS.map((i) => [i.id, i.connected])),
  );

  const toggle = (id: string, next: boolean) =>
    setConnected((prev) => ({ ...prev, [id]: next }));

  const connectedCount = Object.values(connected).filter(Boolean).length;

  return (
    <div style={{ maxWidth: 940, padding: '40px 40px 64px' }}>
      <header style={{ paddingBottom: 24, borderBottom: '1px solid var(--hairline)' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 500, color: 'var(--text-display)' }}>
          Integrations
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
          Connect Winback to the places your documents already live, so a deal starts analysed
          instead of starting with a download.
        </p>
        <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          {connectedCount === 0
            ? 'Nothing connected yet.'
            : `${connectedCount} connected.`}{' '}
          <span style={{ color: 'var(--review-text)' }}>
            Connections are not yet wired to a backend — these switches are a preview.
          </span>
        </p>
      </header>

      {CATEGORY_ORDER.map((category) => {
        const items = INTEGRATIONS.filter((i) => i.category === category);
        if (items.length === 0) return null;

        return (
          <section key={category} style={{ marginTop: 36 }}>
            <h2
              style={{
                margin: '0 0 14px',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: 0.3,
                color: 'var(--text-disabled)',
              }}
            >
              {category}
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: 16,
              }}
            >
              {items.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  connected={connected[integration.id] ?? false}
                  onToggle={toggle}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

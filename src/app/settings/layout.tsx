// ============================================================================
// src/app/settings/layout.tsx — the settings shell.
//
// Its own grouped sidebar, distinct from the product nav: settings is a place
// you go into and come back out of, so it says "Back to Winback" rather than
// repeating the app's own navigation.
// ============================================================================

import { SettingsNav } from '@/components/settings/settings-nav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100%', flex: 1, alignItems: 'stretch' }}>
      <SettingsNav />
      <div style={{ flex: 1, minWidth: 0, background: 'var(--surface-card)' }}>{children}</div>
    </div>
  );
}

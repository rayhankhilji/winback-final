// ============================================================================
// src/components/app-shell/app-shell.tsx
//
// Hides the sidebar (and its Sign out button) on public/unauthenticated
// pages — there's no session yet on /sign-in, /sign-up, /forgot-password,
// /reset-password, or /invite/[token], so nav for a signed-in workspace
// doesn't belong there.
// ============================================================================

'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/app-shell/sidebar';

const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/onboarding', '/motion-preview'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/invite/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !isPublicPath(pathname);

  // /settings carries its own grouped nav and its own full-bleed layout — the
  // product sidebar and the centred max-width main would both fight it.
  if (pathname.startsWith('/settings')) {
    return <div className="flex min-h-full flex-1">{children}</div>;
  }

  return (
    <div className="flex min-h-full flex-1 bg-[var(--surface-canvas)]">
      {showSidebar && (
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      )}
      <main className="wb-workspace-main min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}

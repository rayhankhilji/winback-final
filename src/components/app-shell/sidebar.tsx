// ============================================================================
// src/components/app-shell/sidebar.tsx
//
// Replaces the top Stepper with a persistent left nav. Basic UI only — the
// visual design pass comes later; this just gets the navigation structure
// (Dashboard / New Deal / Ingest / Analysis / Decision / Knowledge Graph)
// and sign-out in place.
// ============================================================================

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useIsMockRun, useRun } from '@/lib/store/RunProvider';
import { WinbackMark } from '@/components/ingestion/winback-mark';
import { BriefcaseBusinessIcon, Building2Icon, HomeIcon, LogOutIcon, PlusIcon, SettingsIcon } from 'lucide-react';

export function Sidebar() {
  const { run } = useRun();
  const isMock = useIsMockRun();
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.push('/sign-in');
  }

  const items: { label: string; href: string; disabled: boolean; icon: typeof HomeIcon }[] = [
    { label: 'Home', href: '/', disabled: false, icon: HomeIcon },
    { label: 'Portfolio', href: '/portfolio', disabled: false, icon: BriefcaseBusinessIcon },
    { label: 'Companies', href: '/companies', disabled: false, icon: Building2Icon },
  ];
  const companyMatch = pathname.match(/^\/companies\/([^/]+)/);
  const companyId = companyMatch?.[1];
  const companyItems = ['Overview', 'Financials', 'Documents', 'Knowledge graph', 'Findings', 'Memo'];

  return (
    <nav className="sticky top-0 flex h-dvh w-72 shrink-0 flex-col overflow-y-auto border-r border-[var(--hairline)] bg-white p-4 lg:w-80">
      <div className="flex items-center gap-3 px-2 pt-1">
        <span className="flex size-10 items-center justify-center rounded-xl text-[var(--text-display)]"><WinbackMark size={28} strokeWidth={2.6} /></span>
        <Link href="/" className="text-lg font-semibold tracking-[-0.04em] text-[var(--text-display)]">Winback</Link>
      </div>
      <div className="mt-8 space-y-1">
        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.13em] text-[var(--text-disabled)]">Workspace</p>
        {run.deal && <p className="truncate text-xs text-muted-foreground">{run.deal.name}</p>}
        {isMock && (
          <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
            MOCK
          </Badge>
        )}
      </div>
      <Link href="/companies/new" className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-[var(--text-display)] px-3 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-px"><PlusIcon className="size-4" />Add a company</Link>

      <ul className="flex-1 space-y-1">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <li key={item.label}>
                <span className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-muted-foreground/50"><Icon className="size-[19px]" />{item.label}</span>
              </li>
            );
          }
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-display)]',
                  active && 'bg-[var(--surface-sunken)] font-medium text-[var(--text-display)]',
                )}
              >
                <Icon className="size-[19px]" />{item.label}
              </Link>
            </li>
          );
        })}
        {companyId && <li className="mt-5 border-t border-[var(--hairline)] pt-4"><p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.13em] text-[var(--text-disabled)]">Company workspace</p><ul className="space-y-1">{companyItems.map((item) => { const tab = item === 'Knowledge graph' ? 'graph' : item.toLowerCase(); return <li key={item}><Link href={`/companies/${companyId}?tab=${tab}`} className="block rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)]">{item}</Link></li>; })}</ul></li>}
      </ul>
      <aside className="mb-4 rounded-2xl border bg-[var(--surface-sunken)]/60 p-4"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Workspace guide</p><ol className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]"><li><span className="mr-2 text-[var(--interactive-text)]">01</span>Add a company</li><li><span className="mr-2 text-[var(--interactive-text)]">02</span>Upload source documents</li><li><span className="mr-2 text-[var(--interactive-text)]">03</span>Review connected evidence</li></ol></aside>

      <div className="space-y-1 border-t border-[var(--hairline)] pt-4"><Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)]"><SettingsIcon className="size-[19px]" />Settings</Link><Button variant="ghost" size="sm" className="h-10 w-full justify-start gap-3 px-3 text-[15px]" onClick={handleSignOut}><LogOutIcon className="size-[19px]" />Sign out</Button></div>
    </nav>
  );
}

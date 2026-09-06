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
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useIsMockRun, useRun } from '@/lib/store/RunProvider';
import { WinbackMark } from '@/components/ingestion/winback-mark';
import { MenuButton } from '@/components/motion/menu-button';
import { BriefcaseBusinessIcon, Building2Icon, HomeIcon, LogOutIcon, PlusIcon, SettingsIcon } from 'lucide-react';

export function Sidebar() {
  const { run } = useRun();
  const isMock = useIsMockRun();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

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
    <nav className={cn('sticky top-0 flex h-dvh shrink-0 flex-col overflow-y-auto border-r border-[var(--hairline)] bg-white p-4 transition-[width] duration-300', collapsed ? 'w-20' : 'w-72 lg:w-80')}>
      <div className={cn('flex items-center px-2 pt-1', collapsed ? 'justify-center' : 'gap-3')}>
        <span className="flex size-10 items-center justify-center rounded-xl text-[var(--text-display)]"><WinbackMark size={28} strokeWidth={2.6} /></span>
        {!collapsed && <Link href="/" className="text-lg font-semibold tracking-[-0.04em] text-[var(--text-display)]">Winback</Link>}
      </div>
      <div className="mt-8 space-y-1">
        {!collapsed && <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.13em] text-[var(--text-disabled)]">Workspace</p>}
        {!collapsed && run.deal && <p className="truncate text-xs text-muted-foreground">{run.deal.name}</p>}
        {isMock && (
          <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
            MOCK
          </Badge>
        )}
      </div>
      <Link href="/companies/new" title="Add a company" className={cn('mb-5 flex items-center justify-center rounded-xl bg-[var(--text-display)] py-3 text-sm font-medium text-white transition-transform hover:-translate-y-px', collapsed ? 'px-0' : 'gap-2 px-3')}><PlusIcon className="size-4" />{!collapsed && 'Add a company'}</Link>

      <ul className="flex-1 space-y-1">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <li key={item.label}>
                <span className={cn('flex rounded-xl px-3 py-2.5 text-[15px] text-muted-foreground/50', collapsed ? 'justify-center' : 'items-center gap-3')}><Icon className="size-[19px]" />{!collapsed && item.label}</span>
              </li>
            );
          }
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                title={item.label}
                className={cn(
                  'flex rounded-xl px-3 py-2.5 text-[15px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-display)]',
                  collapsed ? 'justify-center' : 'items-center gap-3',
                  active && 'bg-[var(--surface-sunken)] font-medium text-[var(--text-display)]',
                )}
              >
                <Icon className="size-[19px]" />{!collapsed && item.label}
              </Link>
            </li>
          );
        })}
        {companyId && !collapsed && <li className="mt-5 border-t border-[var(--hairline)] pt-4"><p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.13em] text-[var(--text-disabled)]">Company workspace</p><ul className="space-y-1">{companyItems.map((item) => { const tab = item === 'Knowledge graph' ? 'graph' : item.toLowerCase(); return <li key={item}><Link href={`/companies/${companyId}?tab=${tab}`} className="block rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)]">{item}</Link></li>; })}</ul></li>}
      </ul>
      {!collapsed && <aside className="mb-4 rounded-2xl border bg-[var(--surface-sunken)]/60 p-4"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Workspace guide</p><ol className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]"><li><span className="mr-2 text-[var(--interactive-text)]">01</span>Add a company</li><li><span className="mr-2 text-[var(--interactive-text)]">02</span>Upload source documents</li><li><span className="mr-2 text-[var(--interactive-text)]">03</span>Review connected evidence</li></ol></aside>}

      <div className="space-y-1 border-t border-[var(--hairline)] pt-4"><Link href="/settings" title="Settings" className={cn('flex rounded-xl px-3 py-2.5 text-[15px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)]', collapsed ? 'justify-center' : 'items-center gap-3')}><SettingsIcon className="size-[19px]" />{!collapsed && 'Settings'}</Link><Button variant="ghost" size="sm" title="Sign out" className={cn('h-10 w-full px-3 text-[15px]', collapsed ? 'justify-center' : 'justify-start gap-3')} onClick={handleSignOut}><LogOutIcon className="size-[19px]" />{!collapsed && 'Sign out'}</Button><MenuButton open={!collapsed} onToggle={() => setCollapsed((value) => !value)} label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="mx-auto block rounded-lg hover:bg-[var(--surface-sunken)]" /></div>
    </nav>
  );
}

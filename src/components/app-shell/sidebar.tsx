'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3Icon,
  BriefcaseBusinessIcon,
  Building2Icon,
  FileTextIcon,
  HomeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  NotebookTextIcon,
  PlusIcon,
  SettingsIcon,
  SparklesIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { WinbackMark } from '@/components/ingestion/winback-mark';
import { MenuButton } from '@/components/motion/menu-button';
import {
  COMPANY_WORKSPACE_SECTIONS,
  companyWorkspaceHref,
  resolveCompanyWorkspaceSection,
} from '@/lib/company-workspace';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useIsMockRun, useRun } from '@/lib/store/RunProvider';
import { cn } from '@/lib/utils';

const SECTION_ICONS = {
  overview: LayoutDashboardIcon,
  financials: BarChart3Icon,
  documents: FileTextIcon,
  findings: SparklesIcon,
  memo: NotebookTextIcon,
};

const WORKSPACE_ITEMS = [
  { label: 'Home', href: '/', icon: HomeIcon },
  { label: 'Portfolio', href: '/portfolio', icon: BriefcaseBusinessIcon },
  { label: 'Companies', href: '/companies', icon: Building2Icon },
];

function CompanyWorkspaceLinks({
  companyId,
  activeSection,
  onNavigate,
}: {
  companyId: string;
  activeSection: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {COMPANY_WORKSPACE_SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.id];
        const active = activeSection === section.id;
        return (
          <li key={section.id}>
            <Link
              href={companyWorkspaceHref(companyId, section.id)}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-[var(--interactive-wash)] font-medium text-[var(--interactive-text)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-display)]',
              )}
            >
              <Icon className="size-4" />
              {section.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar() {
  const { run } = useRun();
  const isMock = useIsMockRun();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const companyMatch = pathname.match(/^\/companies\/([^/]+)/);
  const companyId = companyMatch?.[1] === 'new' ? undefined : companyMatch?.[1];
  const activeCompanySection = resolveCompanyWorkspaceSection(searchParams.get('tab'));

  async function handleSignOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.push('/sign-in');
  }

  return (
    <nav
      aria-label="Workspace"
      className={cn(
        'sticky top-0 flex h-dvh shrink-0 flex-col overflow-y-auto border-r border-[var(--hairline)] bg-white p-3 transition-[width] duration-300 motion-reduce:transition-none sm:p-4',
        collapsed ? 'w-20' : 'w-72 lg:w-80',
      )}
    >
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between gap-2 px-2')}>
        <Link href="/" aria-label="Winback home" className={cn('flex min-w-0 items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-display)]">
            <WinbackMark size={28} strokeWidth={2.6} />
          </span>
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap text-lg font-semibold tracking-[-0.04em] text-[var(--text-display)] transition-all duration-200 motion-reduce:transition-none',
              collapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-32 translate-x-0 opacity-100',
            )}
          >
            Winback
          </span>
        </Link>
        {!collapsed && (
          <MenuButton
            open
            onToggle={() => setCollapsed(true)}
            label="Collapse sidebar"
            className="shrink-0 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
          />
        )}
      </div>

      {collapsed && (
        <div className="mt-3 flex justify-center">
          <MenuButton
            open={false}
            onToggle={() => setCollapsed(false)}
            label="Expand sidebar"
            className="rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
          />
        </div>
      )}

      <div className="mt-7 space-y-1">
        <span
          className={cn(
            'block overflow-hidden whitespace-nowrap px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.13em] text-[var(--text-disabled)] transition-all duration-200 motion-reduce:transition-none',
            collapsed ? 'max-h-0 p-0 opacity-0' : 'max-h-8 opacity-100',
          )}
        >
          Workspace
        </span>
        {!collapsed && run.deal && <p className="truncate px-3 pb-1 text-xs text-muted-foreground">{run.deal.name}</p>}
        {isMock && !collapsed && (
          <Badge className="ml-3 border-amber-500/30 bg-amber-500/20 text-amber-600" variant="outline">
            MOCK
          </Badge>
        )}
      </div>

      <Link
        href="/companies/new"
        title="Add a company"
        className={cn(
          'mt-3 mb-5 flex items-center justify-center rounded-xl bg-[var(--text-display)] py-3 text-sm font-medium text-white transition-transform duration-150 hover:-translate-y-px motion-reduce:transition-none',
          collapsed ? 'px-0' : 'gap-2 px-3',
        )}
      >
        <PlusIcon className="size-4" />
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap transition-all duration-200 motion-reduce:transition-none',
            collapsed ? 'max-w-0 opacity-0' : 'max-w-32 opacity-100',
          )}
        >
          Add a company
        </span>
      </Link>

      <ul className="flex-1 space-y-1">
        {WORKSPACE_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex rounded-xl px-3 py-2.5 text-[15px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-display)]',
                  collapsed ? 'justify-center' : 'items-center gap-3',
                  active && 'bg-[var(--surface-sunken)] font-medium text-[var(--text-display)]',
                )}
              >
                <Icon className="size-[19px] shrink-0" />
                <span
                  className={cn(
                    'overflow-hidden whitespace-nowrap transition-all duration-200 motion-reduce:transition-none',
                    collapsed ? 'max-w-0 opacity-0' : 'max-w-36 opacity-100',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}

        {companyId && !collapsed && (
          <li className="mt-5 border-t border-[var(--hairline)] pt-4">
            <div className="mb-2 flex items-center justify-between px-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-[var(--text-disabled)]">Company workspace</p>
              <Link href="/companies" className="text-xs text-[var(--interactive-text)] hover:underline">All</Link>
            </div>
            <CompanyWorkspaceLinks companyId={companyId} activeSection={activeCompanySection} />
          </li>
        )}

        {companyId && collapsed && (
          <li className="mt-4 flex justify-center">
            <Sheet open={workspaceMenuOpen} onOpenChange={setWorkspaceMenuOpen}>
              <SheetTrigger
                title="Open company workspace"
                aria-label="Open company workspace"
                render={<button type="button" className="flex size-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]" />}
              >
                <Building2Icon className="size-[19px]" />
              </SheetTrigger>
              <SheetContent side="left" className="border-[var(--hairline)] bg-[var(--surface-card)] p-0">
                <SheetHeader className="border-b border-[var(--hairline)] px-6 py-5">
                  <SheetTitle>Company workspace</SheetTitle>
                </SheetHeader>
                <div className="p-4">
                  <Link href="/companies" onClick={() => setWorkspaceMenuOpen(false)} className="mb-3 inline-flex text-sm text-[var(--interactive-text)] hover:underline">All companies</Link>
                  <CompanyWorkspaceLinks companyId={companyId} activeSection={activeCompanySection} onNavigate={() => setWorkspaceMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </li>
        )}
      </ul>

      {!collapsed && (
        <aside className="mb-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-sunken)]/60 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Workspace guide</p>
          <ol className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            <li><span className="mr-2 text-[var(--interactive-text)]">01</span>Add a company</li>
            <li><span className="mr-2 text-[var(--interactive-text)]">02</span>Upload source documents</li>
            <li><span className="mr-2 text-[var(--interactive-text)]">03</span>Review connected evidence</li>
          </ol>
        </aside>
      )}

      <div className="space-y-1 border-t border-[var(--hairline)] pt-4">
        <Link
          href="/settings/integrations"
          title="Settings"
          className={cn('flex rounded-xl px-3 py-2.5 text-[15px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)]', collapsed ? 'justify-center' : 'items-center gap-3')}
        >
          <SettingsIcon className="size-[19px] shrink-0" />
          <span className={cn('overflow-hidden whitespace-nowrap transition-all duration-200 motion-reduce:transition-none', collapsed ? 'max-w-0 opacity-0' : 'max-w-28 opacity-100')}>Settings</span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          title="Sign out"
          className={cn('h-10 w-full px-3 text-[15px]', collapsed ? 'justify-center' : 'justify-start gap-3')}
          onClick={handleSignOut}
        >
          <LogOutIcon className="size-[19px] shrink-0" />
          <span className={cn('overflow-hidden whitespace-nowrap transition-all duration-200 motion-reduce:transition-none', collapsed ? 'max-w-0 opacity-0' : 'max-w-28 opacity-100')}>Sign out</span>
        </Button>
      </div>
    </nav>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, Building2Icon, FileTextIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchCompanies } from '@/lib/client/companies';
import type { CompanyListItem } from '@/lib/contracts/types';

function statusLabel(status: CompanyListItem['status']): string {
  return { not_analysed: 'Not analysed', in_progress: 'In progress', complete: 'Complete', attention: 'Requires attention', failed: 'Needs retry' }[status];
}

function statusClass(status: CompanyListItem['status']): string {
  if (status === 'attention') return 'border-attention/40 bg-attention/15 text-attention-foreground';
  if (status === 'complete') return 'border-stage-done/40 bg-stage-done/15 text-stage-done';
  if (status === 'failed') return 'border-destructive/40 bg-destructive/10 text-destructive';
  return 'border-border bg-muted text-muted-foreground';
}

export default function DashboardPage() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void fetchCompanies().then((result) => {
      if (!active) return;
      if (result.ok) setCompanies(result.companies); else setError(result.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const documents = companies.reduce((total, company) => total + company.documentCount, 0);
  const findings = companies.reduce((total, company) => total + company.findingCount, 0);
  const metrics = [
    { label: 'Companies', value: companies.length, icon: Building2Icon }, { label: 'Documents ingested', value: documents, icon: FileTextIcon },
    { label: 'Evidence-linked findings', value: findings, icon: SparklesIcon },
  ];
  return <div className="mx-auto max-w-[1500px] space-y-8">
    <header className="flex min-h-10 flex-wrap items-center justify-between gap-4 border-b border-[var(--hairline)] pb-5"><div className="flex items-center gap-3"><span className="rounded-lg border bg-white px-2 py-1 text-xs text-muted-foreground">Home</span><p className="text-sm text-muted-foreground">Portfolio intelligence</p></div><Link href="/companies/new" className="rounded-xl border bg-white px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-[var(--surface-sunken)]">Add company</Link></header>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
    <section className="wb-ambient relative isolate min-h-[360px] overflow-hidden rounded-[30px] border border-white/70 px-7 py-9 sm:px-10 sm:py-11">
      <div className="wb-dither pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative grid min-h-[270px] gap-8 lg:grid-cols-[1fr_330px] lg:items-end">
        <div><span className="rounded-full border border-white/80 bg-white/55 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">Winback workspace</span><h1 className="wb-display mt-6 max-w-2xl text-5xl leading-[0.92] text-[var(--text-display)] sm:text-6xl">Start with the documents you already have.</h1><p className="mt-6 max-w-xl text-[15px] leading-7 text-[var(--text-secondary)]">Bring a company into view. Winback turns source documents into a connected, reviewable diligence workspace.</p></div>
        <Link href="/companies/new" className="wb-soft-card group rounded-[20px] bg-white/90 p-6 transition-transform duration-200 hover:-translate-y-1"><div className="flex size-12 items-center justify-center rounded-2xl border border-[var(--hairline)] bg-white text-[var(--text-display)]"><PlusIcon className="size-5" /></div><h3 className="mt-7 text-lg font-medium text-[var(--text-display)]">Add a company</h3><p className="mt-2 text-[15px] leading-6 text-[var(--text-secondary)]">Upload your first deck, contract, model or cap table.</p><span className="mt-7 flex items-center gap-1 text-sm font-medium text-[var(--interactive-text)]">Build a workspace <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" /></span></Link>
      </div>
    </section>
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Portfolio metrics">{metrics.map(({ label, value, icon: Icon }) => <Card key={label} className="wb-soft-card bg-white/80"><CardContent className="flex min-h-32 items-start justify-between p-6"><div><p className="text-[15px] text-muted-foreground">{label}</p><p className="mt-4 text-4xl font-medium tracking-tight tabular-nums">{loading ? '—' : value}</p></div><span className="rounded-2xl bg-[var(--interactive-wash)] p-3 text-[var(--interactive-text)]"><Icon className="size-5" /></span></CardContent></Card>)}</section>
    <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
      <Card className="wb-soft-card"><CardHeader className="flex-row items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Portfolio</p><CardTitle className="mt-1">Companies in view</CardTitle></div><Button variant="ghost" size="sm" render={<Link href="/companies" />}>View all <ArrowRightIcon /></Button></CardHeader><CardContent className="space-y-2">
        {loading && Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
        {!loading && companies.length === 0 && <div className="rounded-2xl border border-dashed bg-[var(--surface-sunken)]/70 p-8 text-center"><p className="font-medium text-[var(--text-display)]">A clear place to start.</p><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add a company to create its document room, analyses and evidence trail.</p><Button className="mt-5" size="sm" render={<Link href="/companies/new" />}>Add a company <ArrowRightIcon /></Button></div>}
        {!loading && companies.slice(0, 6).map((company) => <Link key={company.id} href={`/companies/${company.id}`} className="flex items-center justify-between rounded-xl border px-4 py-3.5 transition-colors hover:bg-[var(--surface-sunken)]"><div><p className="font-medium">{company.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{company.sector ?? 'Sector not set'} · {company.documentCount} document{company.documentCount === 1 ? '' : 's'}</p></div><Badge variant="outline" className={statusClass(company.status)}>{statusLabel(company.status)}</Badge></Link>)}
      </CardContent></Card>
      <Card className="wb-soft-card overflow-hidden"><div className="wb-ambient h-28" /><CardHeader><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Activity</p><CardTitle className="mt-1">Recent analysis</CardTitle></CardHeader><CardContent className="space-y-4">{loading && Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}{!loading && companies.filter((company) => company.lastRunAt).slice(0, 5).map((company) => <div key={company.id} className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{company.name}</p><p className="text-xs text-muted-foreground">{statusLabel(company.status)}</p></div><span className="shrink-0 text-xs text-muted-foreground">{new Date(company.lastRunAt!).toLocaleDateString()}</span></div>)}{!loading && !companies.some((company) => company.lastRunAt) && <p className="text-sm text-muted-foreground">Completed analyses will collect here, with each conclusion connected back to its source.</p>}</CardContent></Card>
    </div>
  </div>;
}

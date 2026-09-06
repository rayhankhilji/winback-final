'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, Building2Icon, FileTextIcon, SparklesIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchCompanies } from '@/lib/client/companies';
import type { CompanyListItem } from '@/lib/contracts/types';

export default function PortfolioPage() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchCompanies().then((result) => {
      if (!active) return;
      if (result.ok) setCompanies(result.companies); else setError(result.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const bySector = useMemo(() => Object.entries(companies.reduce<Record<string, number>>((all, company) => {
    const sector = company.sector ?? 'Unclassified';
    all[sector] = (all[sector] ?? 0) + 1;
    return all;
  }, {})).sort(([, left], [, right]) => right - left), [companies]);
  const documentCount = companies.reduce((count, company) => count + company.documentCount, 0);
  const findingCount = companies.reduce((count, company) => count + company.findingCount, 0);

  const summary = [
    { label: 'Companies tracked', value: companies.length, icon: Building2Icon },
    { label: 'Documents connected', value: documentCount, icon: FileTextIcon },
    { label: 'Evidence-linked findings', value: findingCount, icon: SparklesIcon },
  ];

  return <div className="wb-page space-y-8">
    <header className="border-b border-[var(--hairline)] pb-5"><p className="text-sm text-muted-foreground">Cross-portfolio view</p><h1 className="wb-display mt-2 text-4xl text-[var(--text-display)]">Portfolio</h1><p className="mt-3 max-w-2xl text-[15px] leading-6 text-muted-foreground">A single view of the companies, documents and source-grounded work across your portfolio.</p></header>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
    <section className="grid gap-4 md:grid-cols-3">{summary.map(({ label, value, icon: Icon }) => <Card key={label} className="wb-soft-card"><CardContent className="flex min-h-36 items-start justify-between p-6"><div><p className="text-[15px] text-muted-foreground">{label}</p><p className="mt-4 text-4xl font-medium tracking-tight tabular-nums">{loading ? '—' : value}</p></div><Icon className="size-5 text-[var(--interactive-text)]" /></CardContent></Card>)}</section>
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="wb-soft-card"><CardHeader><p className="text-xs font-medium uppercase tracking-[0.13em] text-muted-foreground">Coverage</p><CardTitle className="mt-2">Portfolio composition</CardTitle></CardHeader><CardContent className="space-y-3">{loading && <Skeleton className="h-40 w-full" />}{!loading && bySector.length === 0 && <p className="text-sm text-muted-foreground">Add a company to start building coverage.</p>}{bySector.map(([sector, count]) => <div key={sector} className="flex items-center justify-between rounded-xl bg-[var(--surface-sunken)] px-4 py-3"><span className="text-sm font-medium">{sector}</span><span className="text-sm tabular-nums text-muted-foreground">{count}</span></div>)}</CardContent></Card>
      <Card className="wb-soft-card overflow-hidden"><div className="wb-ambient h-32" /><CardHeader><p className="text-xs font-medium uppercase tracking-[0.13em] text-muted-foreground">Company workspaces</p><CardTitle className="mt-2">Continue where the evidence lives</CardTitle></CardHeader><CardContent className="space-y-2">{loading && <Skeleton className="h-20 w-full" />}{!loading && companies.slice(0, 4).map((company) => <Link href={`/companies/${company.id}`} key={company.id} className="flex items-center justify-between rounded-xl border px-4 py-4 transition-colors hover:bg-[var(--surface-sunken)]"><div><p className="font-medium">{company.name}</p><p className="mt-1 text-xs text-muted-foreground">{company.documentCount} documents · {company.findingCount} findings</p></div><ArrowRightIcon className="size-4 text-muted-foreground" /></Link>)}{!loading && companies.length === 0 && <Link href="/companies/new" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--interactive-text)]">Add your first company <ArrowRightIcon className="size-4" /></Link>}</CardContent></Card>
    </div>
  </div>;
}

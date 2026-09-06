'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchCompanies } from '@/lib/client/companies';
import type { CompanyListItem } from '@/lib/contracts/types';

const statuses: CompanyListItem['status'][] = ['not_analysed', 'in_progress', 'complete', 'attention', 'failed'];
const label = (status: CompanyListItem['status']) => status.replace('_', ' ');

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('name');
  useEffect(() => { let active = true; void fetchCompanies().then((result) => { if (!active) return; if (result.ok) setCompanies(result.companies); else setError(result.message); setLoading(false); }); return () => { active = false; }; }, []);
  const sectors = useMemo(() => [...new Set(companies.map((company) => company.sector).filter((item): item is string => item !== null))].sort(), [companies]);
  const visible = useMemo(() => companies.filter((company) => (sector === 'all' || company.sector === sector) && (status === 'all' || company.status === status)).sort((a, b) => sort === 'updated' ? (b.lastRunAt ?? '').localeCompare(a.lastRunAt ?? '') : sort === 'findings' ? b.findingCount - a.findingCount : a.name.localeCompare(b.name)), [companies, sector, status, sort]);
  return <div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Portfolio</p><h1 className="font-heading text-3xl font-semibold tracking-tight">Companies</h1></div><Button render={<Link href="/companies/new" />}><PlusIcon /> Add company</Button></header>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="grid gap-3 sm:grid-cols-3"><Select value={sector} onValueChange={(value) => { if (value) setSector(value); }}><SelectTrigger><SelectValue placeholder="Sector" /></SelectTrigger><SelectContent><SelectItem value="all">All sectors</SelectItem>{sectors.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={(value) => { if (value) setStatus(value); }}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select><Select value={sort} onValueChange={(value) => { if (value) setSort(value); }}><SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger><SelectContent><SelectItem value="name">Name</SelectItem><SelectItem value="updated">Last updated</SelectItem><SelectItem value="findings">Findings</SelectItem></SelectContent></Select></div><section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{loading && Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-40" />)}{!loading && visible.map((company) => <Link key={company.id} href={`/companies/${company.id}`}><Card className="h-full transition-colors hover:bg-muted/50"><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-heading text-lg font-semibold">{company.name}</h2><p className="text-sm text-muted-foreground">{company.sector ?? 'Sector not set'}</p></div><Badge variant="outline" className="capitalize">{label(company.status)}</Badge></div><div className="grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Documents</p><p className="mt-1 font-medium tabular-nums">{company.documentCount}</p></div><div><p className="text-xs text-muted-foreground">Findings</p><p className="mt-1 font-medium tabular-nums">{company.findingCount}</p></div><div><p className="text-xs text-muted-foreground">Updated</p><p className="mt-1 text-xs">{company.lastRunAt ? new Date(company.lastRunAt).toLocaleDateString() : '—'}</p></div></div></CardContent></Card></Link>)}{!loading && visible.length === 0 && <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No companies match these filters.</p><Button className="mt-4" variant="outline" onClick={() => { setSector('all'); setStatus('all'); }}>Clear filters</Button></CardContent></Card>}</section></div>;
}

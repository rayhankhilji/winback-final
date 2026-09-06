'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRightIcon,
  BarChart3Icon,
  DownloadIcon,
  FileTextIcon,
  RefreshCwIcon,
  SparklesIcon,
} from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EvidenceChip } from '@/components/evidence/evidence-chip';
import {
  COMPANY_WORKSPACE_SECTIONS,
  resolveCompanyWorkspaceSection,
} from '@/lib/company-workspace';
import { fetchCompanyDetail, reanalyseCompany } from '@/lib/client/company-detail';
import type { CompanyDetailResponseData, CompanyListItem } from '@/lib/contracts/types';

function statusLabel(status: CompanyListItem['status']): string {
  return {
    not_analysed: 'Not analysed',
    in_progress: 'In progress',
    complete: 'Complete',
    attention: 'Requires attention',
    failed: 'Needs retry',
  }[status];
}

function SectionEyebrow({ section }: { section: string }) {
  const label = COMPANY_WORKSPACE_SECTIONS.find((item) => item.id === section)?.label ?? 'Overview';
  return <p className="text-sm font-medium text-[var(--interactive-text)]">{label}</p>;
}

export default function CompanyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<CompanyDetailResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const activeSection = resolveCompanyWorkspaceSection(searchParams.get('tab'));

  useEffect(() => {
    let active = true;
    void fetchCompanyDetail(params.id).then((result) => {
      if (!active) return;
      if (result.ok) setDetail(result.data);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [params.id]);

  async function handleReanalyse() {
    if (!detail) return;
    setStarting(true);
    setActionError(null);
    const result = await reanalyseCompany(detail.company.id);
    if (result.ok) {
      router.push(`/runs/${result.runId}`);
      return;
    }
    setActionError(result.message);
    setStarting(false);
  }

  if (error) {
    return (
      <div className="wb-page max-w-2xl py-12">
        <Card className="wb-soft-card">
          <CardContent className="space-y-4 p-7">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button variant="outline" render={<Link href="/companies" />}>Back to companies</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="wb-page space-y-6">
        <Skeleton className="h-40 w-full rounded-[24px]" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-[20px]" />
          <Skeleton className="h-72 w-full rounded-[20px]" />
        </div>
      </div>
    );
  }

  const { company, latestRun, documents } = detail;
  const profile = latestRun?.extraction?.profile;
  const findings = latestRun?.decision?.crosschecks ?? [];

  return (
    <div className="wb-page space-y-7">
      <header className="wb-page-header flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <SectionEyebrow section={activeSection} />
          <h1 className="wb-display mt-2 text-4xl text-[var(--text-display)] sm:text-5xl">{company.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="border-[var(--hairline)] bg-white text-[var(--text-secondary)]">{statusLabel(company.status)}</Badge>
            <span>{company.sector ?? 'Sector not set'}</span>
            <span aria-hidden="true">·</span>
            <span>{company.documentCount} source document{company.documentCount === 1 ? '' : 's'}</span>
            <span aria-hidden="true">·</span>
            <span>{company.findingCount} findings</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            render={<a href={`/api/companies/${company.id}/export`} />}
          >
            <DownloadIcon />
            Download XLSX
          </Button>
          <Button variant="outline" render={<Link href="/companies/new" />}>
            Add a company
          </Button>
          <Button disabled={starting} onClick={handleReanalyse}>
            <RefreshCwIcon className={starting ? 'animate-spin motion-reduce:animate-none' : undefined} />
            {starting ? 'Starting…' : 'Re-run analysis'}
          </Button>
        </div>
      </header>

      {actionError && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {activeSection === 'overview' && (
        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="wb-soft-card overflow-hidden">
            <div className="wb-panel-artwork h-24" />
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Company profile</p>
              <CardTitle className="mt-2">What the source documents establish</CardTitle>
            </CardHeader>
            <CardContent>
              {profile ? (
                <div className="space-y-6">
                  <p className="max-w-2xl text-[15px] leading-7 text-[var(--text-secondary)]">{profile.businessSummary}</p>
                  <dl className="grid gap-4 border-t border-[var(--hairline)] pt-5 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Headquarters</dt>
                      <dd className="mt-2 text-sm font-medium text-[var(--text-display)]">{profile.hq ?? 'Not stated'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Founded</dt>
                      <dd className="mt-2 text-sm font-medium text-[var(--text-display)]">{profile.foundedYear ?? 'Not stated'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Employees</dt>
                      <dd className="mt-2 text-sm font-medium text-[var(--text-display)]">{profile.employees ?? 'Not stated'}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="wb-empty-state">
                  <SparklesIcon className="size-5 text-[var(--interactive-text)]" />
                  <div>
                    <p className="font-medium text-[var(--text-display)]">Ready when the documents are.</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Run an analysis to turn the source set into a reviewable company profile.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="wb-soft-card">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Review queue</p>
              <CardTitle className="mt-2">Findings from crosschecks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {findings.length > 0 ? findings.slice(0, 3).map((finding) => (
                <div key={finding.id} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-canvas)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--text-display)]">{finding.title}</p>
                    <Badge variant="outline" className="shrink-0 border-[var(--hairline)] text-xs text-[var(--text-secondary)]">{finding.severityHint}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">{finding.explanation}</p>
                </div>
              )) : (
                <div className="wb-empty-state">
                  <FileTextIcon className="size-5 text-[var(--interactive-text)]" />
                  <div>
                    <p className="font-medium text-[var(--text-display)]">Nothing to review yet.</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Completed crosschecks will appear here with their evidence.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {activeSection === 'financials' && (
        <Card className="wb-soft-card overflow-hidden">
          <CardHeader className="border-b border-[var(--hairline)]">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Financials</p>
            <CardTitle className="mt-2">Revenue trajectory</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {profile?.financials.length ? (
              <>
                <div className="h-80 px-3 pt-6 sm:px-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={profile.financials} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                      <XAxis dataKey="fy" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenueUsdM" name="Revenue (USD m)" stroke="var(--interactive)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--surface-card)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-px border-t border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-4">
                  {profile.financials.map((year) => (
                    <div key={year.fy} className="bg-white p-5">
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{year.fy}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-2xl font-medium tracking-tight tabular-nums text-[var(--text-display)]">${year.revenueUsdM}m</p>
                        {year.evidence.length > 0 && <EvidenceChip refs={year.evidence} />}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="wb-empty-state m-6">
                <BarChart3Icon className="size-5 text-[var(--interactive-text)]" />
                <div>
                  <p className="font-medium text-[var(--text-display)]">No extracted financial series.</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">When a source document states historical revenue, each period will appear here with its evidence.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'documents' && (
        <Card className="wb-soft-card overflow-hidden">
          <CardHeader className="flex-row items-end justify-between gap-4 border-b border-[var(--hairline)]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Source room</p>
              <CardTitle className="mt-2">Documents in this workspace</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">{documents.length} document{documents.length === 1 ? '' : 's'}</p>
          </CardHeader>
          <CardContent className="divide-y divide-[var(--hairline)] p-0">
            {documents.map((document) => (
              <div key={document.id} className="group flex flex-wrap items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-[var(--surface-canvas)]">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--interactive-wash)] text-[var(--interactive-text)]">
                    <FileTextIcon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--text-display)]">{document.title ?? document.filename}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{document.docKind ?? 'Unclassified'} · {document.pages} {document.pageNoun}{document.pages === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-[var(--hairline)] bg-white capitalize text-[var(--text-secondary)]">{document.status}</Badge>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="wb-empty-state m-6">
                <FileTextIcon className="size-5 text-[var(--interactive-text)]" />
                <div>
                  <p className="font-medium text-[var(--text-display)]">No source documents yet.</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Add a company with its source set to begin a diligence workspace.</p>
                  <Button className="mt-4" variant="outline" render={<Link href="/companies/new" />}>Add a company <ArrowRightIcon /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'findings' && (
        <section className="space-y-4">
          {findings.map((finding) => (
            <Card key={finding.id} className="wb-soft-card">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-medium tracking-tight text-[var(--text-display)]">{finding.title}</h2>
                  <Badge variant="outline" className="border-[var(--hairline)] text-[var(--text-secondary)]">{finding.status.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className="border-[var(--hairline)] text-[var(--text-secondary)]">Severity hint: {finding.severityHint}</Badge>
                </div>
                <p className="mt-4 max-w-4xl text-[15px] leading-7 text-[var(--text-secondary)]">{finding.explanation}</p>
                {finding.claim.evidence.length > 0 && <div className="mt-4"><EvidenceChip refs={finding.claim.evidence} /></div>}
              </CardContent>
            </Card>
          ))}
          {findings.length === 0 && (
            <Card className="wb-soft-card">
              <CardContent className="wb-empty-state p-7">
                <SparklesIcon className="size-5 text-[var(--interactive-text)]" />
                <div>
                  <p className="font-medium text-[var(--text-display)]">No findings to review.</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Crosscheck findings appear here only after a completed analysis.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {activeSection === 'memo' && (
        <Card className="wb-soft-card overflow-hidden">
          <div className="wb-panel-artwork h-20" />
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Generated with evidence</p>
            <CardTitle className="mt-2">Investment committee memo</CardTitle>
          </CardHeader>
          <CardContent>
            {latestRun?.memo ? (
              <div className="mx-auto max-w-3xl divide-y divide-[var(--hairline)]">
                {latestRun.memo.sections.map((section) => (
                  <section key={section.id} className="py-6 first:pt-0 last:pb-0">
                    <h2 className="text-lg font-medium tracking-tight text-[var(--text-display)]">{section.heading}</h2>
                    <p className="mt-3 text-[15px] leading-7 text-[var(--text-secondary)]">{section.body}</p>
                    {section.evidence.length > 0 && <div className="mt-4"><EvidenceChip refs={section.evidence} /></div>}
                  </section>
                ))}
              </div>
            ) : (
              <div className="wb-empty-state">
                <SparklesIcon className="size-5 text-[var(--interactive-text)]" />
                <div>
                  <p className="font-medium text-[var(--text-display)]">A memo arrives after analysis.</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">It will stay connected to the exact supporting evidence in your source documents.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

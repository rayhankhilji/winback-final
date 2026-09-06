import * as XLSX from 'xlsx';

export interface WorkbookCompany { name: string; sector: string | null }
export interface WorkbookDocument { filename: string; title: string | null; docKind: string | null; pages: number; status: string }
export interface WorkbookRun {
  createdAt: string;
  profile?: { businessSummary?: string; hq?: string | null; foundedYear?: number | null; employees?: number | null; financials?: Array<{ fy: string; revenueUsdM: number; revenueGrowthPct: number | null; grossMarginPct: number | null; ebitdaUsdM: number | null; ebitdaMarginPct: number | null }> };
  findings?: Array<{ title: string; status: string; severityHint: string; explanation: string }>;
  memo?: Array<{ heading: string; body: string }>;
}

function add(wb: XLSX.WorkBook, rows: unknown[][], name: string) {
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
}

/** Deterministic workbook containing only persisted data and model outputs. */
export function buildCompanyWorkbook(company: WorkbookCompany, documents: WorkbookDocument[], run: WorkbookRun | null, exportedAt = new Date().toISOString()): Uint8Array {
  const wb = XLSX.utils.book_new();
  const profile = run?.profile;
  add(wb, [['Company', company.name], ['Sector', company.sector ?? 'Not stated'], ['Exported', exportedAt], ['Analysis run', run?.createdAt ?? 'Not analysed'], [], ['Business summary', profile?.businessSummary ?? 'No completed extraction yet'], ['Headquarters', profile?.hq ?? 'Not stated'], ['Founded', profile?.foundedYear ?? 'Not stated'], ['Employees', profile?.employees ?? 'Not stated']], 'Overview');
  add(wb, [['Fiscal year', 'Revenue (USD m)', 'Growth %', 'Gross margin %', 'EBITDA (USD m)', 'EBITDA margin %'], ...(profile?.financials ?? []).map((year) => [year.fy, year.revenueUsdM, year.revenueGrowthPct, year.grossMarginPct, year.ebitdaUsdM, year.ebitdaMarginPct])], 'Financials');
  add(wb, [['Finding', 'Status', 'Severity hint', 'Explanation'], ...(run?.findings ?? []).map((finding) => [finding.title, finding.status, finding.severityHint, finding.explanation])], 'Insights');
  add(wb, [['Title', 'Filename', 'Kind', 'Pages', 'Status'], ...documents.map((doc) => [doc.title ?? '', doc.filename, doc.docKind ?? '', doc.pages, doc.status])], 'Source documents');
  add(wb, [['Section', 'Content'], ...(run?.memo ?? []).map((section) => [section.heading, section.body])], 'Memo');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

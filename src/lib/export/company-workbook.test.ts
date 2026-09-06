import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildCompanyWorkbook } from './company-workbook';

describe('buildCompanyWorkbook', () => {
  it('creates a readable five-sheet workbook with source-grounded insights', () => {
    const bytes = buildCompanyWorkbook({ name: 'Northstar', sector: 'Software' }, [{ title: 'Management deck', filename: 'deck.pdf', docKind: 'presentation', pages: 12, status: 'parsed' }], { createdAt: '2026-09-06T00:00:00.000Z', profile: { businessSummary: 'Analytics platform', financials: [{ fy: 'FY25', revenueUsdM: 12, revenueGrowthPct: 20, grossMarginPct: 70, ebitdaUsdM: 3, ebitdaMarginPct: 25 }] }, findings: [{ title: 'Revenue reconciliation', status: 'open', severityHint: 'medium', explanation: 'Check contract schedule.' }], memo: [{ heading: 'Summary', body: 'Review retained revenue.' }] }, '2026-09-06T00:00:01.000Z');
    const workbook = XLSX.read(bytes, { type: 'array' });
    expect(workbook.SheetNames).toEqual(['Overview', 'Financials', 'Insights', 'Source documents', 'Memo']);
    expect(XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Insights!, { header: 1 })[1]).toContain('Revenue reconciliation');
    expect(XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['Source documents']!, { header: 1 })[1]).toContain('deck.pdf');
  });
});

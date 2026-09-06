// ============================================================================
// Company-workspace navigation is deliberately shared by the sidebar and the
// page. Keeping the query values here prevents a second, drifting navigation
// system from appearing in the UI.
// ============================================================================

export const COMPANY_WORKSPACE_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'financials', label: 'Financials' },
  { id: 'documents', label: 'Documents' },
  { id: 'findings', label: 'Findings' },
  { id: 'memo', label: 'Memo' },
] as const;

export type CompanyWorkspaceSection = (typeof COMPANY_WORKSPACE_SECTIONS)[number]['id'];

export function resolveCompanyWorkspaceSection(value: string | null): CompanyWorkspaceSection {
  const match = COMPANY_WORKSPACE_SECTIONS.find((section) => section.id === value);
  return match?.id ?? 'overview';
}

export function companyWorkspaceHref(companyId: string, section: CompanyWorkspaceSection): string {
  return `/companies/${encodeURIComponent(companyId)}?tab=${section}`;
}

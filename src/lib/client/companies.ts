// ============================================================================
// Portfolio reads for Screens 3–4. UI components use this module rather than
// calling fetch directly, and responses are validated at the client boundary.
// ============================================================================

import { CompaniesResponseSchema } from '@/lib/contracts/schemas';
import type { CompanyListItem } from '@/lib/contracts/types';

export async function fetchCompanies(): Promise<
  { ok: true; companies: CompanyListItem[] } | { ok: false; message: string }
> {
  const response = await fetch('/api/companies', { cache: 'no-store' });
  const json: unknown = await response.json();
  const parsed = CompaniesResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, message: 'The server sent a response we could not read.' };
  if (!parsed.data.ok) return { ok: false, message: parsed.data.error.message };
  return { ok: true, companies: parsed.data.data.companies };
}

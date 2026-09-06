import { CompanyDetailResponseSchema, IngestResponseSchema } from '@/lib/contracts/schemas';
import type { CompanyDetailResponseData } from '@/lib/contracts/types';

export async function fetchCompanyDetail(id: string): Promise<
  { ok: true; data: CompanyDetailResponseData } | { ok: false; message: string }
> {
  const response = await fetch(`/api/companies/${encodeURIComponent(id)}`, { cache: 'no-store' });
  const json: unknown = await response.json();
  const parsed = CompanyDetailResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, message: 'The server sent a response we could not read.' };
  if (!parsed.data.ok) return { ok: false, message: parsed.data.error.message };
  return { ok: true, data: parsed.data.data };
}

export async function reanalyseCompany(id: string): Promise<{ ok: true; runId: string } | { ok: false; message: string }> {
  const response = await fetch(`/api/companies/${encodeURIComponent(id)}/reanalyse`, { method: 'POST' });
  const json: unknown = await response.json();
  const parsed = IngestResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, message: 'The server sent a response we could not read.' };
  if (!parsed.data.ok) return { ok: false, message: parsed.data.error.message };
  return { ok: true, runId: parsed.data.data.runId };
}

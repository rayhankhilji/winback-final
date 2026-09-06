import { BlockViewerResponseSchema } from '@/lib/contracts/schemas';
import { apiError, apiSuccess, withRoute } from '@/lib/pipeline/http';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function blockFromRow(row: Record<string, unknown>) {
  return {
    id: row.id as string, kind: row.kind as string, text: row.text as string, page: row.page as number,
    ...(row.section ? { section: row.section as string } : {}),
    ...(row.table_json ? { table: row.table_json } : {}),
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ blockId: string }> }) {
  return withRoute(req, 'GET /api/blocks/[blockId]', 'standard', async () => {
    const { blockId } = await ctx.params;
    const db = await createServerSupabaseClient();
    const { data: row, error } = await db.from('document_blocks').select('id, document_id, kind, text, page, section, table_json, ordinal').eq('id', blockId).maybeSingle();
    if (error) throw error;
    if (!row) return apiError('BAD_REQUEST', 'Citation not found');
    const { data: document, error: documentError } = await db.from('documents').select('id, filename, title, doc_kind, pages, page_noun, status, failure_reason').eq('id', row.document_id).maybeSingle();
    if (documentError) throw documentError;
    if (!document) return apiError('BAD_REQUEST', 'Source document not found');
    const lower = Math.max(0, (row.ordinal as number) - 10);
    const upper = (row.ordinal as number) + 10;
    const { data: neighbours, error: neighbourError } = await db.from('document_blocks').select('id, kind, text, page, section, table_json, ordinal').eq('document_id', row.document_id).gte('ordinal', lower).lte('ordinal', upper).order('ordinal');
    if (neighbourError) throw neighbourError;
    const data = {
      block: blockFromRow(row),
      document: { id: document.id as string, filename: document.filename as string, title: (document.title as string | null) ?? null, docKind: (document.doc_kind as string | null) ?? null, pages: document.pages as number, pageNoun: document.page_noun as string, status: document.status as string, failureReason: (document.failure_reason as string | null) ?? null },
      neighbours: (neighbours ?? []).map((neighbour) => blockFromRow(neighbour)),
    };
    const meta = { ms: 0, model: 'none', mock: false };
    const validated = BlockViewerResponseSchema.safeParse({ ok: true as const, data, meta });
    if (!validated.success || !validated.data.ok) return apiError('CONTRACT_VIOLATION', 'Server produced a response that failed its own schema');
    return apiSuccess(validated.data.data, meta);
  });
}

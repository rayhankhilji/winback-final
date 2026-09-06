import { BlockViewerResponseSchema } from '@/lib/contracts/schemas';
import type { BlockViewerResponseData } from '@/lib/contracts/types';

export async function fetchBlockViewer(blockId: string): Promise<
  { ok: true; data: BlockViewerResponseData } | { ok: false; message: string }
> {
  const response = await fetch(`/api/blocks/${encodeURIComponent(blockId)}`, { cache: 'no-store' });
  const json: unknown = await response.json();
  const parsed = BlockViewerResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, message: 'The server sent a response we could not read.' };
  if (!parsed.data.ok) return { ok: false, message: parsed.data.error.message };
  return { ok: true, data: parsed.data.data };
}

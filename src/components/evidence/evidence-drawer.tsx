// ============================================================================
// src/components/evidence/evidence-drawer.tsx — erd.md Part 6 §6.8
//
// The interaction the demo turns on. Mounted once, near the root — every
// chip in the app opens this same instance via useEvidenceDrawer(). Built on
// shadcn's Sheet (a controlled Dialog), which already gives us Esc-to-close,
// backdrop click, and a focus trap for free; we add Tab→open, arrow-key
// prev/next, and the scroll-into-view + quote highlight ourselves.
// ============================================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MessageCircleIcon, SendIcon, SparklesIcon, XIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRun } from '@/lib/store/RunProvider';
import { useEvidenceDrawer } from '@/lib/store/EvidenceDrawerProvider';
import { resolveEvidence } from '@/lib/client/evidence';
import { fetchBlockViewer } from '@/lib/client/blocks';
import type { Block } from '@/lib/contracts/types';

/** Splits a block's text into [before, matched quote, after] for the strong highlight. */
function splitOnQuote(text: string, quote: string): [string, string, string] | null {
  const idx = text.toLowerCase().indexOf(quote.toLowerCase());
  if (idx === -1) return null;
  return [text.slice(0, idx), text.slice(idx, idx + quote.length), text.slice(idx + quote.length)];
}

function BlockRow({ block, isCited, quote, quoteVerified }: { block: Block; isCited: boolean; quote: string; quoteVerified: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCited) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [isCited]);

  const split = isCited && quoteVerified ? splitOnQuote(block.text, quote) : null;

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm leading-relaxed',
        isCited ? 'border-attention/40 bg-attention/10' : 'border-transparent',
      )}
    >
      <div className="mb-1 text-xs text-muted-foreground">
        {block.section ? `${block.section} · ` : ''}
        {block.page}
      </div>
      {split ? (
        <p>
          {split[0]}
          <mark className="rounded bg-attention/30 px-0.5 font-medium text-attention-foreground">{split[1]}</mark>
          {split[2]}
        </p>
      ) : (
        <p>{block.text}</p>
      )}
    </div>
  );
}

export function EvidenceDrawer() {
  const { run } = useRun();
  const { state, close, next, prev } = useEvidenceDrawer();
  const open = state !== null;
  const [remote, setRemote] = useState<{
    blockId: string;
    result: Awaited<ReturnType<typeof fetchBlockViewer>>;
  } | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const ref = state?.refs[state.index];
  const local = ref ? resolveEvidence(ref, state?.docs ?? run.docs) : null;
  const hasLocal = local !== null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, prev]);

  useEffect(() => {
    let active = true;
    const blockId = ref?.blockId;
    if (!blockId || hasLocal) return () => { active = false; };
    void fetchBlockViewer(blockId).then((result) => { if (active) setRemote({ blockId, result }); });
    return () => { active = false; };
  }, [ref?.blockId, hasLocal]);

  if (!state) return null;
  const remoteResult = remote && remote.blockId === ref?.blockId ? remote.result : null;
  const remoteData = remoteResult?.ok ? remoteResult.data : null;
  const blocks = local ? local.doc.blocks : remoteData?.neighbours ?? [];
  const citedBlock = local ? local.block : remoteData?.block ?? null;
  const title = local ? local.doc.title : remoteData?.document.title ?? remoteData?.document.filename;
  const filename = local ? local.doc.filename : remoteData?.document.filename;
  const pageNoun = local ? local.doc.pageNoun : remoteData?.document.pageNoun;
  const contextualCount = blocks.filter((block) => !block.deprecated).length;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent className="relative w-full gap-0 p-0 sm:max-w-md">
        {citedBlock && title && filename && pageNoun ? (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-start justify-between gap-3"><div><SheetTitle>{title}</SheetTitle>
              <SheetDescription>
                {filename} · {pageNoun.charAt(0).toUpperCase() + pageNoun.slice(1)} {citedBlock.page}
              </SheetDescription></div><Button variant="outline" size="sm" onClick={() => setAssistantOpen((open) => !open)}><SparklesIcon /> Ask</Button></div>
            </SheetHeader>
            {state.refs.length > 1 && (
              <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
                <span>
                  {state.index + 1} of {state.refs.length} citations
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={prev} aria-label="Previous citation">
                    <ChevronLeftIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={next} aria-label="Next citation">
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {blocks
                .filter((b) => !b.deprecated)
                .map((b) => (
                  <BlockRow
                    key={b.id}
                    block={b}
                    isCited={b.id === citedBlock.id}
                    quote={ref?.quote ?? ''}
                    quoteVerified={ref?.quoteVerified ?? false}
                  />
                ))}
            </div>
            {assistantOpen && (
              <aside className="absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-2xl border bg-white shadow-2xl">
                <div className="wb-ambient relative border-b px-4 py-3"><div className="wb-dither absolute inset-0 opacity-40" /><div className="relative flex items-center justify-between"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-white/80 text-[var(--interactive-text)]"><MessageCircleIcon className="size-4" /></span><div><p className="text-sm font-medium text-[var(--text-display)]">Ask Winback</p><p className="text-[11px] text-[var(--text-secondary)]">Evidence-only document helper</p></div></div><Button variant="ghost" size="icon-sm" aria-label="Close assistant" onClick={() => setAssistantOpen(false)}><XIcon /></Button></div></div>
                <div className="max-h-44 space-y-3 overflow-y-auto p-4 text-sm"><p className="leading-5 text-[var(--text-secondary)]">I’ll keep the conversation anchored to this citation and its {contextualCount} nearby passages.</p>{submittedQuestion && <><p className="ml-7 rounded-xl bg-[var(--surface-sunken)] px-3 py-2 text-[var(--text-primary)]">{submittedQuestion}</p><p className="mr-7 rounded-xl bg-[var(--interactive-wash)] px-3 py-2 leading-5 text-[var(--text-primary)]">Open the highlighted passage to verify the quoted language. I can trace facts in this document; conclusions remain tied to source evidence.</p></>}</div>
                <form className="flex gap-2 border-t p-3" onSubmit={(event) => { event.preventDefault(); const next = question.trim(); if (!next) return; setSubmittedQuestion(next); setQuestion(''); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this citation…" className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--interactive)]/30" /><Button type="submit" size="icon-sm" disabled={!question.trim()} aria-label="Ask about this citation"><SendIcon /></Button></form>
              </aside>
            )}
          </>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">{remoteResult && !remoteResult.ok ? remoteResult.message : 'Loading citation…'}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

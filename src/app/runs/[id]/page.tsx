'use client';

// ============================================================================
// /runs/[id] — Screen 2, the processing screen.
//
// It exists to make a 60–120 second wait feel like work rather than a hang.
// Polls every 1.5s and never shows a bare indeterminate spinner: the stepper,
// the verbatim stage line, elapsed seconds and per-document status all say
// what is actually happening.
//
// A failed document shows its reason inline and the run carries on — one bad
// file must never fail the whole run.
// ============================================================================

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { fetchRunProgress } from '@/lib/client/ingest';
import { StageStepper } from '@/components/ingest/stage-stepper';
import { ProcessingOrbit } from '@/components/ingest/processing-orbit';
import { SuccessTick } from '@/components/motion/success-tick';
import type { DocumentProgress, RunProgress } from '@/lib/contracts/types';

const POLL_MS = 1_500;

const DOC_STATE: Record<DocumentProgress['status'], { label: string; color: string; wash: string }> = {
  pending: { label: 'Queued', color: 'var(--text-secondary)', wash: 'var(--surface-sunken)' },
  parsing: { label: 'Reading', color: 'var(--text-primary)', wash: 'var(--ai-wash)' },
  parsed: { label: 'Read', color: 'var(--positive-text)', wash: 'var(--positive-wash)' },
  failed: { label: 'Failed', color: 'var(--failed-text)', wash: 'var(--failed-wash)' },
};

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const routed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const result = await fetchRunProgress(id);
      if (cancelled) return;

      if (!result.ok) {
        setError(result.message);
        return; // stop polling: a 404 or a contract failure will not fix itself
      }

      setError(null);
      setProgress(result.progress);

      if (result.progress.status === 'complete') {
        if (routed.current) return;
        routed.current = true;
        // Let the tick land before leaving — the confirmation is the point.
        setTimeout(() => {
          toast.success('Analysis complete', {
            description: 'The company has been added to your portfolio.',
          });
          router.push('/');
        }, 900);
        return;
      }

      if (result.progress.status === 'failed') return;

      timer = setTimeout(poll, POLL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, router, attempt]);

  // --- error -------------------------------------------------------------
  if (error) {
    return (
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ margin: 0, fontSize: 20, color: 'var(--text-display)' }}>
          We lost track of this analysis
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>{error}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={() => { setError(null); setAttempt((n) => n + 1); }}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: 'none', background: 'var(--ai)', color: 'var(--text-display)', cursor: 'pointer' }}
          >
            Retry
          </button>
          <Link
            href="/"
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--hairline)', color: 'var(--text-primary)', textDecoration: 'none' }}
          >
            Back
          </Link>
        </div>
      </div>
    );
  }

  // --- loading (first poll) ----------------------------------------------
  if (!progress) {
    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ height: 18, width: 220, borderRadius: 6, background: 'var(--surface-sunken)' }} />
        <div style={{ height: 300, marginTop: 24, borderRadius: 12, background: 'var(--surface-sunken)' }} />
      </div>
    );
  }

  const failed = progress.status === 'failed';
  const complete = progress.status === 'complete';
  const seconds = Math.floor(progress.elapsedMs / 1000);
  const settled = progress.documents.filter((d) => d.status === 'parsed' || d.status === 'failed').length;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-display)' }}>
        {complete ? 'Analysis complete' : failed ? 'Analysis stopped' : 'Reading your documents'}
      </h1>
      <p style={{ margin: '8px 0 26px', fontSize: 14, color: 'var(--text-secondary)' }}>
        {complete
          ? 'Every figure is now traceable back to the document it came from.'
          : failed
            ? 'Nothing has been lost — you can retry once the problem below is fixed.'
            : 'This usually takes a minute or two. You can leave this page open.'}
      </p>

      <div
        style={{
          padding: '28px 24px',
          borderRadius: 12,
          border: '1px solid var(--hairline)',
          background: 'var(--surface-card)',
        }}
      >
        {complete ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
            <SuccessTick size={72} label="Analysis complete" />
          </div>
        ) : (
          <ProcessingOrbit size={300} />
        )}

        <div style={{ marginTop: 24 }}>
          <StageStepper stage={progress.stage} status={progress.status} />
        </div>

        <div style={{ marginTop: 18, textAlign: 'center' }} aria-live="polite">
          {/* stage_detail is written for the user, so it is shown verbatim. */}
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>
            {progress.stageDetail ?? (complete ? 'Done' : failed ? 'Stopped' : 'Working…')}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            {seconds}s elapsed · {settled} of {progress.documents.length} documents
            {progress.llmCalls > 0 ? ` · ${progress.llmCalls} model calls` : ''}
          </p>
        </div>
      </div>

      {failed && progress.error ? (
        <div style={{ marginTop: 18, padding: 14, borderRadius: 8, background: 'var(--failed-wash)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--failed-text)' }}>{progress.error}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Link
              href="/companies/new"
              style={{ fontSize: 13, color: 'var(--interactive-text)', textDecoration: 'none' }}
            >
              Try again with different files
            </Link>
            <Link href="/" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Back to dashboard
            </Link>
          </div>
        </div>
      ) : null}

      <h2 style={{ margin: '30px 0 12px', fontSize: 12, fontWeight: 500, letterSpacing: 0.3, color: 'var(--text-disabled)' }}>
        Documents
      </h2>

      {progress.documents.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No documents on this run.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {progress.documents.map((doc) => {
            const state = DOC_STATE[doc.status];
            return (
              <li
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '11px 14px',
                  marginBottom: 8,
                  borderRadius: 8,
                  border: '1px solid var(--hairline)',
                  background: 'var(--surface-card)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>
                    {doc.title ?? doc.filename}
                  </p>
                  {doc.title ? (
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-disabled)' }}>
                      {doc.filename}
                    </p>
                  ) : null}
                  {/* A failure is a named row with a reason, never a missing one. */}
                  {doc.failureReason ? (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--failed-text)' }}>
                      {doc.failureReason}
                    </p>
                  ) : null}
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    padding: '3px 9px',
                    borderRadius: 999,
                    fontSize: 11,
                    background: state.wash,
                    color: state.color,
                  }}
                >
                  {state.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

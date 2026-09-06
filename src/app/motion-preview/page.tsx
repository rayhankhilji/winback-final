'use client';

// ============================================================================
// /motion-preview — a local harness for the motion components.
//
// Not a product screen and not linked from anywhere. It exists so these
// components can be looked at in every state without a database, a run, or a
// signed-in user. Delete it, or keep it as the place new motion gets checked.
// ============================================================================

import { useState } from 'react';
import { IngestionOrbit } from '@/components/ingestion/ingestion-orbit';
import { WinbackMark } from '@/components/ingestion/winback-mark';
import { MenuButton } from '@/components/motion/menu-button';
import { SuccessTick } from '@/components/motion/success-tick';
import type { DocumentProgress, RunStage } from '@/lib/contracts/types';

const DOCS: DocumentProgress[] = [
  { id: '1', filename: 'management-deck.pdf', title: null, status: 'parsed', failureReason: null },
  { id: '2', filename: 'customer-contracts.docx', title: null, status: 'parsed', failureReason: null },
  { id: '3', filename: 'cap-table.xlsx', title: null, status: 'parsing', failureReason: null },
  { id: '4', filename: 'board-deck.pptx', title: null, status: 'pending', failureReason: null },
  { id: '5', filename: 'scan.png', title: null, status: 'failed', failureReason: 'No readable text.' },
];

const STAGES: RunStage[] = ['parse', 'extract', 'analyse', 'crosscheck'];

export default function MotionPreviewPage() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<RunStage>('parse');

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
        padding: 40,
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 20, color: 'var(--text-display)' }}>Motion preview</h1>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mark</h2>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 12 }}>
          <WinbackMark size={96} strokeWidth={2.4} title="Winback" />
          <WinbackMark size={48} strokeWidth={2.8} />
          <WinbackMark size={24} strokeWidth={3.4} />
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Ingestion orbit</h2>
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--hairline)',
                background: stage === s ? 'var(--ai-wash)' : 'var(--surface-card)',
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--hairline)',
            borderRadius: 12,
            padding: 32,
            maxWidth: 420,
          }}
        >
          <IngestionOrbit
            documents={DOCS}
            stage={stage}
            stageDetail="Parsing 3 of 5 — cap-table.xlsx"
            elapsedMs={14_200}
          />
        </div>
      </section>

      <section style={{ marginTop: 40, display: 'flex', gap: 48, alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Menu button</h2>
          <MenuButton open={open} onToggle={() => setOpen((v) => !v)} />
        </div>
        <div>
          <h2 style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Success</h2>
          <SuccessTick size={56} label="Complete" />
        </div>
      </section>
    </main>
  );
}

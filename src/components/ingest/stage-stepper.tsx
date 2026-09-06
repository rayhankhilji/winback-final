'use client';

// ============================================================================
// src/components/ingest/stage-stepper.tsx
//
// Parse → Extract → Analyse → Crosscheck.
//
// SCREENS.md says to reuse the existing stepper in `src/components/app-shell/`
// and not build a second one. There isn't one — the doc is wrong about the
// codebase (recorded in CHECKLIST.md). This is that one stepper, built once
// here so the instruction holds from now on.
// ============================================================================

import type { RunStage, RunStatus } from '@/lib/contracts/types';

const STAGES: Array<{ id: RunStage; label: string }> = [
  { id: 'parse', label: 'Parse' },
  { id: 'extract', label: 'Extract' },
  { id: 'analyse', label: 'Analyse' },
  { id: 'crosscheck', label: 'Crosscheck' },
];

type StepState = 'done' | 'active' | 'pending' | 'failed';

function stateFor(index: number, currentIndex: number, status: RunStatus): StepState {
  if (status === 'complete') return 'done';
  if (status === 'failed') {
    if (index < currentIndex) return 'done';
    return index === currentIndex ? 'failed' : 'pending';
  }
  if (index < currentIndex) return 'done';
  return index === currentIndex ? 'active' : 'pending';
}

const DOT: Record<StepState, { background: string; border: string }> = {
  done: { background: 'var(--positive)', border: 'var(--positive)' },
  active: { background: 'var(--ai)', border: 'var(--ai)' },
  pending: { background: 'var(--surface-card)', border: 'var(--hairline)' },
  failed: { background: 'var(--failed-text)', border: 'var(--failed-text)' },
};

export interface StageStepperProps {
  stage: RunStage;
  status: RunStatus;
}

export function StageStepper({ stage, status }: StageStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <ol
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {STAGES.map((s, i) => {
        const state = stateFor(i, currentIndex, status);
        const dot = DOT[state];

        return (
          <li
            key={s.id}
            style={{ display: 'flex', alignItems: 'center', flex: i === STAGES.length - 1 ? '0 0 auto' : 1 }}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: dot.background,
                  border: `1.5px solid ${dot.border}`,
                  transition: 'background 220ms var(--ease-standard), border-color 220ms var(--ease-standard)',
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  color:
                    state === 'pending'
                      ? 'var(--text-disabled)'
                      : state === 'failed'
                        ? 'var(--failed-text)'
                        : 'var(--text-primary)',
                  fontWeight: state === 'active' ? 500 : 400,
                }}
              >
                {s.label}
              </span>
            </span>

            {i < STAGES.length - 1 ? (
              <span
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: 1,
                  margin: '0 12px',
                  background: i < currentIndex ? 'var(--positive)' : 'var(--hairline)',
                  transition: 'background 220ms var(--ease-standard)',
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

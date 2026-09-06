'use client';

// ============================================================================
// src/components/ingestion/ingestion-orbit.tsx
//
// The processing state: each uploaded document orbits the Winback mark on its
// own connector, and the connector carries a travelling pulse while that
// document is actually being read.
//
// Modelled on the reference animation in design/reference/ — sources
// converging on one centre — but rebuilt rather than embedded. That file is
// another company's branding, its colours are baked hex, and a Lottie cannot
// answer `prefers-reduced-motion`. See design/reference/README.md.
//
// **This is determinate, which is the point.** DESIGN.md rules out an
// indefinite spinner for long waits: the ring is driven by how many documents
// have actually finished, each node carries its own document's real status,
// and a connector pulses only while that document is being parsed. Nothing
// here moves for decoration — if it moves, something is happening.
// ============================================================================

import type { DocumentProgress, RunStage } from '@/lib/contracts/types';
import { WinbackMark } from './winback-mark';

const VIEWBOX = 320;
const CENTRE = VIEWBOX / 2;
const ORBIT_RADIUS = 116;
const CENTRE_RADIUS = 42;
const NODE_RADIUS = 21;
const RING_RADIUS = CENTRE_RADIUS + 10;

/** More than this and the ring becomes a scatter of unreadable dots. */
const MAX_VISIBLE_NODES = 9;

export interface IngestionOrbitProps {
  documents: DocumentProgress[];
  stage: RunStage;
  /** Rendered verbatim beneath the orbit — it is written for the user. */
  stageDetail?: string | null;
  /** Shown as elapsed seconds so a 40-second wait reads as working. */
  elapsedMs?: number;
  className?: string;
}

type NodeState = 'pending' | 'parsing' | 'parsed' | 'failed';

interface Placed {
  doc: DocumentProgress;
  state: NodeState;
  x: number;
  y: number;
  angle: number;
}

/** Nodes sit on a circle, starting at the top and going clockwise. */
function place(documents: DocumentProgress[]): Placed[] {
  const visible = documents.slice(0, MAX_VISIBLE_NODES);
  return visible.map((doc, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / visible.length;
    return {
      doc,
      state: doc.status as NodeState,
      x: CENTRE + ORBIT_RADIUS * Math.cos(angle),
      y: CENTRE + ORBIT_RADIUS * Math.sin(angle),
      angle,
    };
  });
}

/** The connector stops at both circles' edges rather than running under them. */
function connector(node: Placed) {
  const fromX = CENTRE + CENTRE_RADIUS * Math.cos(node.angle);
  const fromY = CENTRE + CENTRE_RADIUS * Math.sin(node.angle);
  const toX = node.x - NODE_RADIUS * Math.cos(node.angle);
  const toY = node.y - NODE_RADIUS * Math.sin(node.angle);
  return { fromX, fromY, toX, toY };
}

const STROKE: Record<NodeState, string> = {
  pending: 'var(--hairline)',
  parsing: 'var(--ai)',
  parsed: 'var(--positive)',
  failed: 'var(--failed-text)',
};

const FILL: Record<NodeState, string> = {
  pending: 'var(--surface-sunken)',
  parsing: 'var(--ai-wash)',
  parsed: 'var(--positive-wash)',
  failed: 'var(--failed-wash)',
};

/** Two or three characters at most — a node is 42px across. */
function extensionOf(filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase() ?? '';
  return ext.length > 0 && ext.length <= 4 ? ext : 'DOC';
}

const STAGE_LABEL: Record<RunStage, string> = {
  parse: 'Reading documents',
  extract: 'Extracting facts',
  analyse: 'Benchmarking',
  crosscheck: 'Cross-checking claims',
};

export function IngestionOrbit({
  documents,
  stage,
  stageDetail,
  elapsedMs,
  className,
}: IngestionOrbitProps) {
  const nodes = place(documents);
  const overflow = documents.length - nodes.length;

  const settled = documents.filter((d) => d.status === 'parsed' || d.status === 'failed').length;
  const fraction = documents.length > 0 ? settled / documents.length : 0;

  const ringCircumference = 2 * Math.PI * RING_RADIUS;
  const ringOffset = ringCircumference * (1 - fraction);

  const seconds = elapsedMs === undefined ? null : Math.floor(elapsedMs / 1000);

  // One live region, not one per node: a screen reader should hear the run's
  // state change, not eight documents announcing themselves.
  const summary =
    documents.length === 0
      ? STAGE_LABEL[stage]
      : `${STAGE_LABEL[stage]}. ${settled} of ${documents.length} documents processed.`;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width="100%"
        role="img"
        aria-label={summary}
        style={{ maxWidth: VIEWBOX, display: 'block', margin: '0 auto' }}
      >
        {/* Orbit path. A hairline, not a feature — it exists so the nodes read
            as one system rather than as scattered dots. */}
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={ORBIT_RADIUS}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={1}
          strokeDasharray="2 6"
          opacity={0.7}
        />

        {nodes.map((node) => {
          const { fromX, fromY, toX, toY } = connector(node);
          const length = Math.hypot(toX - fromX, toY - fromY);
          const isActive = node.state === 'parsing';

          return (
            <g key={node.doc.id}>
              <line
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                stroke={STROKE[node.state]}
                strokeWidth={isActive ? 2 : 1}
                strokeLinecap="round"
                opacity={node.state === 'pending' ? 0.8 : 1}
              />
              {/* The travelling pulse. Only while this document is being read —
                  a line that always moves would say nothing. */}
              {isActive ? (
                <line
                  className="wb-orbit-flow"
                  x1={toX}
                  y1={toY}
                  x2={fromX}
                  y2={fromY}
                  stroke="var(--ai)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  style={{ ['--wb-dash' as string]: `${length / 4} ${length}` }}
                />
              ) : null}
            </g>
          );
        })}

        {nodes.map((node) => (
          <g key={`${node.doc.id}-node`} className="wb-orbit-node">
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill={FILL[node.state]}
              stroke={STROKE[node.state]}
              strokeWidth={node.state === 'pending' ? 1 : 1.5}
            />
            {node.state === 'parsed' ? (
              <path
                d={`M ${node.x - 6} ${node.y} l 4 4.5 l 8 -9`}
                fill="none"
                stroke="var(--positive-text)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : node.state === 'failed' ? (
              <path
                d={`M ${node.x - 5} ${node.y - 5} l 10 10 M ${node.x + 5} ${node.y - 5} l -10 10`}
                stroke="var(--failed-text)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ) : (
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                letterSpacing={0.4}
                fill="var(--text-secondary)"
              >
                {extensionOf(node.doc.filename)}
              </text>
            )}
          </g>
        ))}

        {overflow > 0 ? (
          <text
            x={CENTRE}
            y={VIEWBOX - 6}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-secondary)"
          >
            +{overflow} more
          </text>
        ) : null}

        {/* Determinate progress ring: how many documents have actually
            settled, not how long something has been spinning. */}
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={2}
        />
        <circle
          className="wb-orbit-ring"
          cx={CENTRE}
          cy={CENTRE}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--ai)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringOffset}
          transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
        />

        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={CENTRE_RADIUS}
          fill="var(--surface-card)"
          stroke="var(--hairline)"
          strokeWidth={1}
        />
        <g
          className={fraction < 1 ? 'wb-orbit-active' : undefined}
          transform={`translate(${CENTRE - 20} ${CENTRE - 20})`}
          color="var(--text-display)"
        >
          <WinbackMark size={40} strokeWidth={2.6} />
        </g>
      </svg>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          {STAGE_LABEL[stage]}
        </p>
        {stageDetail ? (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {stageDetail}
          </p>
        ) : null}
        {seconds !== null ? (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            {seconds}s elapsed
          </p>
        ) : null}
      </div>

      {/* The state change a screen reader hears, once, politely. */}
      <span aria-live="polite" className="sr-only">
        {summary}
      </span>
    </div>
  );
}

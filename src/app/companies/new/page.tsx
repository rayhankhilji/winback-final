'use client';

// ============================================================================
// /companies/new — Screen 1, where messy data comes in.
//
// Name, sector, drag-and-drop. Unsupported files are rejected AT THE PICKER
// with a named reason, before a byte is uploaded — watching a file upload and
// then being told it was never readable is the worst version of this screen.
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Trash2, Upload } from 'lucide-react';
import {
  ACCEPT_ATTRIBUTE,
  extensionOf,
  rejectionReason,
  startIngest,
  uploadFile,
} from '@/lib/client/ingest';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

const SECTORS = [
  'Healthcare Services',
  'Software',
  'Industrials',
  'Consumer',
  'Financial Services',
  'Business Services',
  'Energy',
  'Other',
];

interface Queued {
  file: File;
  id: string;
}

interface Rejected {
  name: string;
  reason: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function NewCompanyPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [sector, setSector] = useState(SECTORS[0]!);
  const [queued, setQueued] = useState<Queued[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback((files: FileList | null) => {
    if (!files) return;
    const nextQueued: Queued[] = [];
    const nextRejected: Rejected[] = [];

    for (const file of Array.from(files)) {
      const reason = rejectionReason(file);
      if (reason) nextRejected.push({ name: file.name, reason });
      else nextQueued.push({ file, id: `${file.name}-${file.size}-${file.lastModified}` });
    }

    setQueued((prev) => {
      const seen = new Set(prev.map((q) => q.id));
      return [...prev, ...nextQueued.filter((q) => !seen.has(q.id))];
    });
    setRejected(nextRejected);
  }, []);

  const canSubmit = name.trim().length > 0 && queued.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createBrowserSupabaseClient();

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Your session has expired. Sign in again.');

      const { data: membership, error: memberError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', auth.user.id)
        .limit(1)
        .maybeSingle();
      if (memberError || !membership) throw new Error('No organisation found for your account.');
      const orgId = membership.org_id as string;

      setProgress('Creating company…');
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ org_id: orgId, name: name.trim(), sector })
        .select('id')
        .single();
      if (companyError || !company) throw new Error(companyError?.message ?? 'Could not create the company.');

      const paths: string[] = [];
      for (const [i, item] of queued.entries()) {
        setProgress(`Uploading ${i + 1} of ${queued.length} — ${item.file.name}`);
        paths.push(await uploadFile(orgId, company.id as string, item.file));
      }

      setProgress('Starting analysis…');
      const started = await startIngest(company.id as string, paths);
      if (!started.ok) throw new Error(started.message);

      router.push(`/runs/${started.runId}`);
    } catch (err) {
      // Human language, never a stack trace.
      setError(err instanceof Error ? err.message : 'Something went wrong starting the analysis.');
      setBusy(false);
      setProgress(null);
    }
  }

  const label = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 };
  const field = {
    width: '100%',
    padding: '9px 11px',
    fontSize: 14,
    borderRadius: 8,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 500, color: 'var(--text-display)' }}>
        Add a company
      </h1>
      <p style={{ margin: '8px 0 28px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Drop in whatever you have. Decks, contracts, cap tables, spreadsheets, scans — Winback reads
        them and cites every figure back to the line it came from.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label htmlFor="company-name" style={label}>Company name</label>
          <input
            id="company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kestrelbrook Health Partners"
            style={field}
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor="company-sector" style={label}>Sector</label>
          <select
            id="company-sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            style={field}
            disabled={busy}
          >
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
        style={{
          marginTop: 24,
          padding: '38px 24px',
          borderRadius: 12,
          border: `1.5px dashed ${dragging ? 'var(--ai)' : 'var(--hairline-strong)'}`,
          background: dragging ? 'var(--ai-wash)' : 'var(--surface-sunken)',
          textAlign: 'center',
          transition: 'background 150ms var(--ease-standard), border-color 150ms var(--ease-standard)',
        }}
      >
        <Upload size={22} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
        <p style={{ margin: '10px 0 4px', fontSize: 14, color: 'var(--text-primary)' }}>
          Drag files here
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
          PDF, DOCX, PPTX, XLSX, CSV, PNG, JPG
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{
            marginTop: 14,
            padding: '7px 14px',
            fontSize: 13,
            borderRadius: 8,
            border: '1px solid var(--hairline)',
            background: 'var(--surface-card)',
            color: 'var(--text-primary)',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          onChange={(e) => { accept(e.target.files); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
      </div>

      {rejected.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            margin: '14px 0 0',
            padding: 12,
            borderRadius: 8,
            background: 'var(--failed-wash)',
          }}
        >
          {rejected.map((r) => (
            <li key={r.name} style={{ fontSize: 13, color: 'var(--failed-text)' }}>
              <strong style={{ fontWeight: 500 }}>{r.name}</strong> — {r.reason}
            </li>
          ))}
        </ul>
      ) : null}

      {queued.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0 }}>
          {queued.map((q) => (
            <li
              key={q.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                marginBottom: 8,
                borderRadius: 8,
                border: '1px solid var(--hairline)',
                background: 'var(--surface-card)',
              }}
            >
              <FileText size={16} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {q.file.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-disabled)', textTransform: 'uppercase' }}>
                {extensionOf(q.file.name)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 64, textAlign: 'right' }}>
                {formatSize(q.file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${q.file.name}`}
                disabled={busy}
                onClick={() => setQueued((prev) => prev.filter((p) => p.id !== q.id))}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p style={{ marginTop: 18, padding: 12, borderRadius: 8, background: 'var(--failed-wash)', color: 'var(--failed-text)', fontSize: 13 }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 26 }}>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 8,
            border: 'none',
            // DESIGN.md: the primary button is pink with dark text, because
            // white on this pink is 2.51:1 and fails badly.
            background: canSubmit ? 'var(--ai)' : 'var(--surface-deep)',
            color: canSubmit ? 'var(--text-display)' : 'var(--text-disabled)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {busy ? 'Working…' : 'Analyse documents'}
        </button>
        {progress ? (
          <span aria-live="polite" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {progress}
          </span>
        ) : null}
      </div>
    </div>
  );
}

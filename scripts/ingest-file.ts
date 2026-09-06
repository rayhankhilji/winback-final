// ============================================================================
// scripts/ingest-file.ts — Stage 3's "done when".
//
// Takes a real file from disk, parses it into ordered, addressable blocks, and
// writes them to `documents` and `document_blocks`. Reads them back through
// the contract to prove the round trip, because a block that cannot be loaded
// back is a citation that will dangle.
//
//   pnpm tsx scripts/ingest-file.ts <file> --company <uuid> [--org <uuid>]
//   pnpm tsx scripts/ingest-file.ts <file> --dry-run
//
// --dry-run parses and prints without touching the database or Storage, which
// is how to check a parser against a real document with no Supabase project.
//
// Uses the service-role key: this is an operator tool run from a terminal, not
// a user request. Nothing here is reachable from the browser.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { config } from 'dotenv';
import { parseDocument } from '../src/lib/ingestion';
import { loadDocument, persistDocument } from '../src/lib/ingestion/persist';

config({ path: '.env.local', quiet: true });

interface Args {
  file: string;
  companyId?: string;
  orgId?: string;
  dryRun: boolean;
  skipClassify: boolean;
}

function parseArgs(argv: string[]): Args {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const file = positional[0];
  if (!file) {
    console.error('usage: tsx scripts/ingest-file.ts <file> --company <uuid> [--org <uuid>] [--dry-run] [--skip-classify]');
    process.exit(2);
  }
  return {
    file,
    companyId: flag('company'),
    orgId: flag('org'),
    dryRun: argv.includes('--dry-run'),
    skipClassify: argv.includes('--skip-classify'),
  };
}

function preview(text: string, max = 90): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filename = basename(args.file);
  const data = new Uint8Array(readFileSync(args.file));
  const documentId = randomUUID();

  console.log(`\nParsing ${filename} (${(data.byteLength / 1024).toFixed(1)} KB) as ${documentId}`);

  const { doc, strategy, usedVisionFallback, classified } = await parseDocument({
    documentId,
    filename,
    data,
    skipClassify: args.skipClassify,
  });

  console.log(`  strategy       ${strategy}${usedVisionFallback ? ' (no text layer — vision fallback)' : ''}`);
  console.log(`  classified     ${classified ? 'yes' : 'no — deterministic fallback used'}`);
  console.log(`  title          ${doc.title}`);
  console.log(`  kind           ${doc.kind}`);
  console.log(`  dateLabel      ${doc.dateLabel || '(none stated)'}`);
  console.log(`  ${doc.pages} ${doc.pageNoun}(s), ${doc.blocks.length} blocks\n`);

  for (const b of doc.blocks.slice(0, 12)) {
    console.log(`  ${b.id.padEnd(46)} p${String(b.page).padEnd(3)} ${b.kind.padEnd(10)} ${preview(b.text)}`);
  }
  if (doc.blocks.length > 12) console.log(`  … ${doc.blocks.length - 12} more`);

  // Ordering and addressability are the two properties Stage 3 is judged on,
  // so assert them here rather than trusting the parser.
  const ids = doc.blocks.map((b) => b.id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate block ids — citations would collide');
  let lastPage = 0;
  for (const b of doc.blocks) {
    if (b.page < lastPage) throw new Error(`block ${b.id} regresses to page ${b.page} after ${lastPage}`);
    lastPage = b.page;
  }
  console.log('\n  ids unique, pages non-decreasing.');

  if (args.dryRun) {
    console.log('  --dry-run: nothing written.\n');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || /placeholder/i.test(`${url}${serviceKey}`)) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to real values in .env.local. Use --dry-run to parse without a database.',
    );
  }
  if (!args.companyId) throw new Error('--company <uuid> is required unless --dry-run');

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  let orgId = args.orgId;
  if (!orgId) {
    const { data: company, error } = await db
      .from('companies')
      .select('org_id')
      .eq('id', args.companyId)
      .single();
    if (error || !company) throw new Error(`company ${args.companyId} not found: ${error?.message}`);
    orgId = company.org_id as string;
  }

  const storagePath = `${orgId}/${args.companyId}/${filename}`;
  const written = await persistDocument({
    db,
    doc,
    orgId,
    companyId: args.companyId,
    storagePath,
  });
  console.log(`\n  wrote documents/${written.documentId} and ${written.blocks} document_blocks`);

  // Round trip: what comes back must equal what went in, validated by the
  // contract on the way out. This is the property the evidence drawer relies
  // on months later.
  const reloaded = await loadDocument(db, documentId);
  if (reloaded.blocks.length !== doc.blocks.length) {
    throw new Error(`round trip lost blocks: wrote ${doc.blocks.length}, read ${reloaded.blocks.length}`);
  }
  for (let i = 0; i < doc.blocks.length; i += 1) {
    const a = doc.blocks[i]!;
    const b = reloaded.blocks[i]!;
    if (a.id !== b.id) throw new Error(`round trip reordered blocks at ${i}: ${a.id} != ${b.id}`);
    if (a.text !== b.text) throw new Error(`round trip altered text of ${a.id}`);
  }
  console.log(`  round trip OK — ${reloaded.blocks.length} blocks read back in order, contract-valid.\n`);
}

main().catch((err) => {
  console.error(`\ningest-file failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

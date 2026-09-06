// ============================================================================
// The question BUILD_PLAN.md Stage 4 says to answer before building screens:
// do the crosscheck procedures fire on documents that are NOT the Kestrel
// fixtures?
//
// They could not, before this stage: every definition selected its inputs by
// hardcoded fixture doc id, so an uploaded document with a uuid matched
// nothing and zero crosschecks ran. These tests pin the fix — selection is by
// document KIND — and are the regression guard on assumption A1.
//
// This tests selection and satisfiability, which is where the bug was. Whether
// the model's *answers* transfer needs a real key and real documents (Q13).
// ============================================================================

import { describe, expect, it } from 'vitest';
import { CROSSCHECK_DEFS } from '@/lib/pipeline/prompts';
import { defIsSatisfiable, selectDocsForDef, MAX_DOCS_PER_CROSSCHECK } from '@/lib/pipeline/crosscheck';
import { TARGET_DOCS } from '@/data/target';
import type { DocKind, SourceDoc } from '@/lib/contracts/types';

function uploadedDoc(id: string, kind: DocKind, title: string): SourceDoc {
  return {
    id,
    kind,
    title,
    filename: `${title}.pdf`,
    dateLabel: 'March 2026',
    pages: 1,
    pageNoun: 'page',
    blocks: [{ id: `${id}-p1-b1`, kind: 'paragraph', text: `${title} content.`, page: 1 }],
  };
}

const UPLOADED: SourceDoc[] = [
  uploadedDoc('7f1c2e3a-0000-4000-8000-000000000001', 'presentation', 'Acme Management Deck'),
  uploadedDoc('7f1c2e3a-0000-4000-8000-000000000002', 'contract', 'Acme Customer MSA'),
  uploadedDoc('7f1c2e3a-0000-4000-8000-000000000003', 'cap_table', 'Acme Cap Table'),
];

describe('crosscheck definitions select by kind, not by fixture id', () => {
  it('declares no hardcoded document ids anywhere', () => {
    for (const { def } of CROSSCHECK_DEFS) {
      expect(def).not.toHaveProperty('docIds');
      expect(def.docKinds.length).toBeGreaterThan(0);
    }
  });

  it('fires every definition on uploaded documents with uuid ids', () => {
    const satisfiable = CROSSCHECK_DEFS.filter(({ def }) => defIsSatisfiable(def, UPLOADED));
    expect(satisfiable).toHaveLength(CROSSCHECK_DEFS.length);

    for (const { def } of CROSSCHECK_DEFS) {
      const selected = selectDocsForDef(def, UPLOADED);
      expect(selected.length).toBeGreaterThan(0);
      // The documents chosen are the uploads, not fixtures leaking in.
      for (const d of selected) expect(UPLOADED).toContain(d);
    }
  });

  it('still fires every definition on the Kestrel fixtures', () => {
    for (const { def } of CROSSCHECK_DEFS) {
      expect(defIsSatisfiable(def, TARGET_DOCS)).toBe(true);
      expect(selectDocsForDef(def, TARGET_DOCS).length).toBeGreaterThan(0);
    }
  });

  it('does not run a comparison when one side is missing', () => {
    // A revenue-durability check with no contracts would answer confidently
    // from half the evidence, which is worse than not answering.
    const deckOnly = UPLOADED.filter((d) => d.kind === 'presentation');
    const revenue = CROSSCHECK_DEFS.find(({ def }) => def.id === 'recurring_revenue');
    expect(revenue).toBeDefined();
    expect(defIsSatisfiable(revenue!.def, deckOnly)).toBe(false);
  });

  it('selects every document of a needed kind, not just the first', () => {
    const manyContracts: SourceDoc[] = [
      UPLOADED[0]!,
      ...Array.from({ length: 4 }, (_, i) =>
        uploadedDoc(`7f1c2e3a-0000-4000-8000-00000000001${i}`, 'contract', `MSA ${i}`),
      ),
    ];
    const revenue = CROSSCHECK_DEFS.find(({ def }) => def.id === 'recurring_revenue')!;
    const selected = selectDocsForDef(revenue.def, manyContracts);
    expect(selected.filter((d) => d.kind === 'contract')).toHaveLength(4);
  });

  it('caps selection so a company with forty contracts cannot blow the context window', () => {
    const many: SourceDoc[] = Array.from({ length: 40 }, (_, i) =>
      uploadedDoc(`7f1c2e3a-0000-4000-8000-0000000${String(i).padStart(5, '0')}`, 'contract', `MSA ${i}`),
    );
    const revenue = CROSSCHECK_DEFS.find(({ def }) => def.id === 'recurring_revenue')!;
    expect(selectDocsForDef(revenue.def, many)).toHaveLength(MAX_DOCS_PER_CROSSCHECK);
  });
});

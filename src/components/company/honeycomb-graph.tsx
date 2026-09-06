'use client';

/** A compact source-density map. Each coloured cell represents a real source
 * document; pale cells deliberately represent empty available graph space. */
export function HoneycombGraph({ documents }: { documents: Array<{ id: string; title: string | null; filename: string }> }) {
  const cells = Array.from({ length: 58 }, (_, index) => index);
  const colors = ['var(--interactive)', 'var(--positive)', 'var(--ai)', 'var(--review-text)'];
  return <div className="grid grid-cols-10 gap-1.5 rounded-2xl bg-[var(--surface-sunken)] p-5 sm:grid-cols-[repeat(12,minmax(0,1fr))]" aria-label={`${documents.length} source documents mapped`}>
    {cells.map((cell) => {
      const document = documents[cell % Math.max(documents.length, 1)];
      const active = Boolean(document) && cell > 8 && cell < documents.length * 8 + 18;
      return <span key={cell} title={active ? (document?.title ?? document?.filename) : undefined} className="aspect-square [clip-path:polygon(25%_6.7%,75%_6.7%,100%_50%,75%_93.3%,25%_93.3%,0_50%)]" style={{ background: active ? colors[cell % colors.length] : 'var(--surface-card)', opacity: active ? 0.9 : 0.78 }} />;
    })}
  </div>;
}

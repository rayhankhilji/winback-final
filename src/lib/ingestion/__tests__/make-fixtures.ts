// ============================================================================
// Test fixture generation. Real PDF, DOCX and XLSX bytes, built in memory so
// no binary blobs live in the repo and the parsers are exercised against
// genuine file formats rather than mocks.
//
// Test-only. Nothing in src/ imports this.
// ============================================================================

import JSZip from 'jszip';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// PDF — hand-built, uncompressed, one content stream per page.
// ---------------------------------------------------------------------------

function escapePdfText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Each inner array is one page; each string is one line, rendered top-down. */
export function makePdf(pages: string[][]): Uint8Array {
  const objects: string[] = [];
  const pageCount = pages.length;

  // 1 = Catalog, 2 = Pages, 3 = Font, then per page: content stream, page.
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageObjNums = pages.map((_, i) => 4 + i * 2 + 1);
  objects.push(
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  );
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  for (const lines of pages) {
    const body = lines
      .map((line, i) => `BT /F1 12 Tf 72 ${720 - i * 28} Td (${escapePdfText(line)}) Tj ET`)
      .join('\n');
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${objects.length} 0 R >>`,
    );
  }

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}

/** A PDF with pages but no text — stands in for a scan. */
export function makeTextlessPdf(pageCount: number): Uint8Array {
  return makePdf(Array.from({ length: pageCount }, () => []));
}

// ---------------------------------------------------------------------------
// DOCX — the minimum OOXML package mammoth accepts.
// ---------------------------------------------------------------------------

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

// Real Word documents always ship styles.xml, and mammoth will not match a
// style by name without it — an undefined style id is reported as
// "Unrecognised paragraph style" and falls through to a plain paragraph. A
// fixture without this part would not be a realistic DOCX.
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/></w:style>
</w:styles>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function para(text: string, style?: string): string {
  const props = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${props}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

export interface DocxPart {
  kind: 'heading' | 'paragraph' | 'bullet' | 'table';
  text?: string;
  rows?: string[][];
}

export async function makeDocx(parts: DocxPart[]): Promise<Uint8Array> {
  const body = parts
    .map((p) => {
      if (p.kind === 'heading') return para(p.text ?? '', 'Heading1');
      if (p.kind === 'bullet') return para(p.text ?? '', 'ListParagraph');
      if (p.kind === 'table') {
        const rows = (p.rows ?? [])
          .map(
            (r) =>
              `<w:tr>${r
                .map((c) => `<w:tc><w:tcPr/>${para(c)}</w:tc>`)
                .join('')}</w:tr>`,
          )
          .join('');
        return `<w:tbl><w:tblPr/>${rows}</w:tbl>`;
      }
      return para(p.text ?? '');
    })
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}</w:body></w:document>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('word/document.xml', documentXml);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
  zip.file('word/styles.xml', STYLES_XML);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

export function makeXlsx(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

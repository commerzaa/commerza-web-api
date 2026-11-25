'use strict';
/**
 * Minimal PdfPTable replacement for the batch03 port of All_Member_List.CreatePdf (iTextSharp is .NET only and no PDF package is installed).
 * Not a router (lives in _shared/).
 * Exports: class PdfTable(numCols)  .SetWidths(arr) .AddCell({ text, colspan, border, paddingBottom, padding, align, bg:[r,g,b], color:[r,g,b] })
 *          renderPdf(table, { pageWidth=595, pageHeight=842, margins=0, fontSize=8 }) : Buffer
 * PORT-NOTE: approximates iTextSharp layout: Helvetica-Bold, cells clamped to the remaining columns of the current row (iText behaviour),
 * an incomplete last row is dropped (iText default), word-wrap with an average glyph width, 0.5pt black borders, no header-row repeat.
 */

class PdfTable {
  constructor(numCols) {
    this.numCols = numCols;
    this.widths = new Array(numCols).fill(1);
    this.rows = [];
    this.cur = [];
    this.curIdx = 0;
    this.WidthPercentage = 100;
    this.HeaderRows = 0;
  }

  SetWidths(w) { this.widths = w.slice(); }

  AddCell(cell) {
    let colspan = Math.max(1, cell.colspan || 1);
    colspan = Math.min(colspan, this.numCols - this.curIdx);
    this.cur.push({ ...cell, colspan, startCol: this.curIdx });
    this.curIdx += colspan;
    if (this.curIdx >= this.numCols) {
      this.rows.push(this.cur);
      this.cur = [];
      this.curIdx = 0;
    }
  }
}

const esc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const rgb = (c) => c.map((x) => (x / 255).toFixed(3)).join(' ');

function wrap(text, maxWidth, fontSize) {
  const cw = fontSize * 0.58; // average Helvetica-Bold glyph width
  const maxChars = Math.max(1, Math.floor(maxWidth / cw));
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      let w = word;
      while (w.length > maxChars) {
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, maxChars));
        w = w.slice(maxChars);
      }
      const cand = line ? `${line} ${w}` : w;
      if (cand.length > maxChars) { out.push(line); line = w; } else line = cand;
    }
    out.push(line);
  }
  return out;
}

function renderPdf(table, opts = {}) {
  const pageWidth = opts.pageWidth || 595;
  const pageHeight = opts.pageHeight || 842;
  const margin = opts.margins || 0;
  const fs = opts.fontSize || 8;
  const leading = fs * 1.5;
  const totalW = (pageWidth - 2 * margin) * (table.WidthPercentage / 100);
  const sumW = table.widths.reduce((a, b) => a + b, 0);
  const colW = table.widths.map((w) => (w / sumW) * totalW);
  const colX = [];
  let acc = margin;
  for (const w of colW) { colX.push(acc); acc += w; }

  const pages = [];
  let ops = [];
  let y = pageHeight - margin;
  for (const row of table.rows) {
    const laid = row.map((c) => {
      const width = colW.slice(c.startCol, c.startCol + c.colspan).reduce((a, b) => a + b, 0);
      const pad = c.padding === undefined ? 2 : c.padding;
      const padB = c.paddingBottom === undefined ? pad : c.paddingBottom;
      const lines = wrap(c.text || '', width - 2 * pad, fs);
      return { c, width, pad, padB, lines, h: pad + padB + lines.length * leading };
    });
    const h = Math.max(...laid.map((l) => l.h));
    if (y - h < margin && ops.length) { pages.push(ops); ops = []; y = pageHeight - margin; }
    for (const l of laid) {
      const x = colX[l.c.startCol];
      if (l.c.bg) ops.push(`${rgb(l.c.bg)} rg ${x.toFixed(2)} ${(y - h).toFixed(2)} ${l.width.toFixed(2)} ${h.toFixed(2)} re f`);
      if (l.c.border !== 0) ops.push(`0 0 0 RG 0.5 w ${x.toFixed(2)} ${(y - h).toFixed(2)} ${l.width.toFixed(2)} ${h.toFixed(2)} re S`);
      ops.push(`${rgb(l.c.color || [0, 0, 0])} rg`);
      l.lines.forEach((t, i) => {
        const tw = t.length * fs * 0.58;
        let tx = x + l.pad;
        if (l.c.align === 'center') tx = x + (l.width - tw) / 2;
        const ty = y - l.pad - (i + 1) * leading + (leading - fs) / 2;
        ops.push(`BT /F1 ${fs} Tf ${tx.toFixed(2)} ${ty.toFixed(2)} Td (${esc(t)}) Tj ET`);
      });
    }
    y -= h;
  }
  pages.push(ops);

  // ---- serialise
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pagesId = objs.length + 1 + pages.length * 2; // reserved below
  const pageIds = [];
  for (const p of pages) {
    const content = p.join('\n');
    const cId = add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${cId} 0 R >>`));
  }
  add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const catId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

module.exports = { PdfTable, renderPdf };

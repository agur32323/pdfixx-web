import { degrees, PDFDocument, type PDFFont, type PDFPage, rgb } from "@cantoo/pdf-lib";
import fontkit from "@cantoo/fontkit";

/**
 * PDF operations that need no DOM, so they can run in a web worker (see
 * worker.ts). Files never leave the device; the cloud tools are in cloud.ts.
 */

// Names are set explicitly: they cross the worker boundary and survive minification.
export class WrongPassword extends Error {
  name = "WrongPassword";
}
export class NeedsPassword extends Error {
  name = "NeedsPassword";
}

export type Bytes = Uint8Array;

export async function bytesOf(file: Blob): Promise<Bytes> {
  return new Uint8Array(await file.arrayBuffer());
}

export async function loadPdf(bytes: Bytes, password?: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { password, updateMetadata: false });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    if (!password && msg.includes("encrypted")) {
      // Restricted PDFs (an owner password but no open password) decrypt with an empty one.
      try {
        return await PDFDocument.load(bytes, { password: "", updateMetadata: false });
      } catch {
        throw new NeedsPassword();
      }
    }
    if (msg.includes("password")) throw password ? new WrongPassword() : new NeedsPassword();
    throw e;
  }
}

/** Same check on a file, reading only its first and last few hundred KB. */
export async function isEncryptedFile(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 256 * 1024)).arrayBuffer());
  const decode = (a: Bytes) => new TextDecoder("latin1").decode(a);
  return /\/Encrypt[\s/<\d]/.test(decode(tail)) || (/\/Linearized/.test(decode(head)) && /\/Encrypt[\s/<\d]/.test(decode(head)));
}

/** Looks for the /Encrypt entry in the trailer instead of parsing the whole file. */
export async function isEncrypted(bytes: Bytes): Promise<boolean> {
  const window = 256 * 1024;
  const decode = (a: Bytes) => new TextDecoder("latin1").decode(a);
  const head = decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));
  const tail = decode(bytes.subarray(Math.max(0, bytes.length - window)));
  return /\/Encrypt[\s/<\d]/.test(tail) || /\/Linearized/.test(head) && /\/Encrypt[\s/<\d]/.test(head);
}

export const save = (doc: PDFDocument) => doc.save({ useObjectStreams: true });

export const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;

// ---------------------------------------------------------------- page ranges

/** Parses "1-3, 5, 8-10" into groups of zero-based page indexes. Null if invalid. */
export function parseRanges(input: string, max: number): number[][] | null {
  const parts = input
    .replace(/[;|]/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const groups: number[][] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < 1 || a > max || b > max) return null;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    groups.push(Array.from({ length: hi - lo + 1 }, (_, i) => (a <= b ? lo + i : hi - i) - 1));
  }
  return groups;
}

// ------------------------------------------------------------ organize pages

export async function merge(inputs: { bytes: Bytes; password?: string }[], onProgress?: (done: number) => void): Promise<Bytes> {
  const out = await PDFDocument.create();
  for (let i = 0; i < inputs.length; i++) {
    const src = await loadPdf(inputs[i].bytes, inputs[i].password);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    onProgress?.(i + 1);
  }
  return save(out);
}

/** A new PDF with the given pages (zero-based), in that order. */
export async function extract(bytes: Bytes, indexes: number[], password?: string): Promise<Bytes> {
  const src = await loadPdf(bytes, password);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indexes);
  pages.forEach((p) => out.addPage(p));
  return save(out);
}

export async function extractMany(bytes: Bytes, groups: number[][], password?: string): Promise<Bytes[]> {
  const src = await loadPdf(bytes, password);
  const outs: Bytes[] = [];
  for (const g of groups) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, g);
    pages.forEach((p) => out.addPage(p));
    outs.push(await save(out));
  }
  return outs;
}

/** Reorders, removes and rotates pages: `order` lists source pages with extra rotation. */
export async function organize(bytes: Bytes, order: { index: number; rotation: number }[], password?: string): Promise<Bytes> {
  const src = await loadPdf(bytes, password);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(
    src,
    order.map((o) => o.index),
  );
  pages.forEach((p, i) => {
    p.setRotation(degrees((p.getRotation().angle + order[i].rotation + 360) % 360));
    out.addPage(p);
  });
  return save(out);
}

export async function rotate(bytes: Bytes, rotations: number[], password?: string): Promise<Bytes> {
  const doc = await loadPdf(bytes, password);
  doc.getPages().forEach((p, i) => {
    const r = rotations[i] ?? 0;
    if (r) p.setRotation(degrees((p.getRotation().angle + r + 360) % 360));
  });
  return save(doc);
}

// ------------------------------------------------------------------ compress

/** Re-saves the file with compact object streams; keeps text and quality. */
export async function compressLossless(bytes: Bytes, password?: string): Promise<Bytes> {
  const doc = await loadPdf(bytes, password);
  return save(doc);
}

// ------------------------------------------------------- drawing on the page

let fontBytes: Promise<[ArrayBuffer, ArrayBuffer]> | undefined;

/** Roboto covers Turkish letters (ğ, ş, İ), which the standard PDF fonts don't. */
async function fonts(doc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  fontBytes ??= Promise.all([
    fetch(new URL("/fonts/Roboto-Regular.ttf", self.location.origin)).then((r) => r.arrayBuffer()),
    fetch(new URL("/fonts/Roboto-Bold.ttf", self.location.origin)).then((r) => r.arrayBuffer()),
  ]);
  const [r, b] = await fontBytes;
  doc.registerFontkit(fontkit);
  return { regular: await doc.embedFont(r, { subset: true }), bold: await doc.embedFont(b, { subset: true }) };
}

/**
 * A page as the reader sees it (after its /Rotate). Coordinates are in that
 * upright view, origin bottom-left; `place` converts them back to PDF space.
 */
function view(page: PDFPage) {
  const { width: W, height: H } = page.getSize();
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  const vw = r % 180 === 0 ? W : H;
  const vh = r % 180 === 0 ? H : W;
  const place = (vx: number, vy: number) => {
    switch (r) {
      case 90:
        return { x: W - vy, y: vx };
      case 180:
        return { x: W - vx, y: H - vy };
      case 270:
        return { x: vy, y: H - vx };
      default:
        return { x: vx, y: vy };
    }
  };
  return { vw, vh, r, place };
}

const hexColor = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** Draws text upright in the reader's view, rotated by `angle` (degrees, counter-clockwise). */
function drawUpright(
  page: PDFPage,
  text: string,
  o: { x: number; y: number; size: number; font: PDFFont; color: string; opacity: number; angle?: number },
) {
  const { place, r } = view(page);
  const p = place(o.x, o.y);
  page.drawText(text, {
    x: p.x,
    y: p.y,
    size: o.size,
    font: o.font,
    color: hexColor(o.color),
    opacity: o.opacity,
    rotate: degrees(r + (o.angle ?? 0)),
  });
}

export type WatermarkOptions = {
  text: string;
  size: "small" | "medium" | "large";
  opacity: number;
  color: string;
  layout: "diagonal" | "horizontal" | "tiled";
};

export async function watermark(bytes: Bytes, o: WatermarkOptions, password?: string): Promise<Bytes> {
  const doc = await loadPdf(bytes, password);
  const { bold } = await fonts(doc);
  for (const page of doc.getPages()) {
    const { vw, vh } = view(page);
    const base = Math.min(vw, vh);
    const size = base * { small: 0.06, medium: 0.1, large: 0.15 }[o.size] * (o.layout === "tiled" ? 0.55 : 1);
    const tw = bold.widthOfTextAtSize(o.text, size);
    const th = size * 0.7;
    const angle = o.layout === "horizontal" ? 0 : 45;
    const a = (angle * Math.PI) / 180;
    // Anchor so the text's centre lands on (cx, cy).
    const at = (cx: number, cy: number) => ({
      x: cx - (Math.cos(a) * tw) / 2 + (Math.sin(a) * th) / 2,
      y: cy - (Math.sin(a) * tw) / 2 - (Math.cos(a) * th) / 2,
    });
    const centers: [number, number][] = [];
    if (o.layout === "tiled") {
      const stepX = tw * 0.85 + size * 2;
      const stepY = size * 5;
      for (let y = stepY / 2, row = 0; y < vh + stepY; y += stepY, row++) {
        for (let x = (row % 2 ? stepX / 2 : 0) + stepX / 4; x < vw + stepX; x += stepX) centers.push([x, y]);
      }
    } else {
      centers.push([vw / 2, vh / 2]);
    }
    for (const [cx, cy] of centers) {
      const p = at(cx, cy);
      drawUpright(page, o.text, { x: p.x, y: p.y, size, font: bold, color: o.color, opacity: o.opacity, angle });
    }
  }
  return save(doc);
}

export type NumberPosition = "bl" | "bc" | "br" | "tl" | "tc" | "tr";
export type NumberFormat = "n" | "page_n" | "n_of_total";

export async function pageNumbers(
  bytes: Bytes,
  o: { position: NumberPosition; format: NumberFormat; startAt: number; skipFirst: boolean; size: number; pageWord: string },
  password?: string,
): Promise<Bytes> {
  const doc = await loadPdf(bytes, password);
  const { regular } = await fonts(doc);
  const pages = doc.getPages();
  const counted = pages.length - (o.skipFirst ? 1 : 0);
  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return;
    const n = o.startAt + i - (o.skipFirst ? 1 : 0);
    const label =
      o.format === "n" ? `${n}` : o.format === "page_n" ? `${o.pageWord} ${n}` : `${n} / ${o.startAt + counted - 1}`;
    const { vw, vh } = view(page);
    const w = regular.widthOfTextAtSize(label, o.size);
    const m = Math.max(24, Math.min(vw, vh) * 0.05);
    const x = o.position.endsWith("l") ? m : o.position.endsWith("r") ? vw - m - w : (vw - w) / 2;
    const y = o.position.startsWith("t") ? vh - m - o.size * 0.7 : m;
    drawUpright(page, label, { x, y, size: o.size, font: regular, color: "#344054", opacity: 1 });
  });
  return save(doc);
}

/** A rectangle on a page as fractions of the upright page, origin top-left. */
export type Placement = { page: number; x: number; y: number; w: number; h: number };

/** Places PNG images (signatures, drawings) on pages. */
export async function placeImages(bytes: Bytes, items: { png: ArrayBuffer; at: Placement }[], password?: string): Promise<Bytes> {
  const doc = await loadPdf(bytes, password);
  const cache = new Map<ArrayBuffer, Awaited<ReturnType<PDFDocument["embedPng"]>>>();
  for (const it of items) {
    let img = cache.get(it.png);
    if (!img) {
      img = await doc.embedPng(it.png);
      cache.set(it.png, img);
    }
    const page = doc.getPage(it.at.page);
    const { vw, vh, r, place } = view(page);
    const w = it.at.w * vw;
    const h = it.at.h * vh;
    const p = place(it.at.x * vw, vh - (it.at.y * vh + h));
    page.drawImage(img, { x: p.x, y: p.y, width: w, height: h, rotate: degrees(r) });
  }
  return save(doc);
}

// ------------------------------------------------------------------ security

export async function protect(bytes: Bytes, password: string, currentPassword?: string): Promise<Bytes> {
  const doc = await loadPdf(bytes, currentPassword);
  doc.encrypt({ userPassword: password, ownerPassword: password, algorithm: "AES-256" });
  return doc.save({ useObjectStreams: false });
}

export async function unlock(bytes: Bytes, password: string): Promise<Bytes> {
  const doc = await loadPdf(bytes, password);
  return save(doc);
}

// ------------------------------------------------------------- text → PDF

/** A simple A4 document with a title, a subtitle and wrapped paragraphs (assistant answers). */
export async function textToPdf(title: string, subtitle: string, body: string): Promise<Bytes> {
  const doc = await PDFDocument.create();
  const { regular, bold } = await fonts(doc);
  const [W, H] = SIZES.a4;
  const m = 56;
  const maxW = W - m * 2;
  let page = doc.addPage([W, H]);
  let y = H - m;

  const wrap = (text: string, font: PDFFont, size: number) => {
    const lines: string[] = [];
    for (const para of text.split("\n")) {
      if (!para.trim()) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > maxW && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  };
  const write = (text: string, font: PDFFont, size: number, color: string, gap = 1.45) => {
    for (const line of wrap(text, font, size)) {
      if (y < m + size) {
        page = doc.addPage([W, H]);
        y = H - m;
      }
      y -= size * gap;
      if (line) page.drawText(line, { x: m, y, size, font, color: hexColor(color) });
    }
  };

  write(title, bold, 18, "#101828", 1.3);
  y -= 4;
  write(subtitle, regular, 9.5, "#667085");
  y -= 10;
  page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.6, color: hexColor("#E6E8EC") });
  y -= 8;
  write(body, regular, 11, "#101828", 1.55);
  return save(doc);
}

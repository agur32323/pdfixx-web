"use client";

import { PDFDocument } from "@cantoo/pdf-lib";

import * as core from "./engine-core";
import { save, SIZES, type Bytes } from "./engine-core";
import { canvasToBlob, openPdf, renderPage } from "./render";

/**
 * Everything that changes a PDF in the browser. Plain PDF work runs in a web
 * worker so large files don't freeze the page; work that draws on a canvas
 * (rasterizing, images) stays here.
 */
export { bytesOf, isEncrypted, isEncryptedFile, NeedsPassword, parseRanges, WrongPassword } from "./engine-core";
export type { Bytes, NumberFormat, NumberPosition, Placement, WatermarkOptions } from "./engine-core";

type Core = typeof core;
type Op = "merge" | "extract" | "extractMany" | "organize" | "rotate" | "compressLossless" | "watermark" | "pageNumbers" | "placeImages" | "protect" | "unlock" | "textToPdf";

let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void; progress?: (n: number) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: { name: string; message: string }; progress?: number }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      if (e.data.progress !== undefined) return p.progress?.(e.data.progress);
      pending.delete(e.data.id);
      if (e.data.error) {
        const { name, message } = e.data.error;
        p.reject(name === "WrongPassword" ? new core.WrongPassword() : name === "NeedsPassword" ? new core.NeedsPassword() : Object.assign(new Error(message), { name }));
      } else p.resolve(e.data.result);
    };
    worker.onerror = () => {
      // If the worker can't start, fall back to the main thread from now on.
      worker = null;
      for (const p of pending.values()) p.reject(new Error("worker failed"));
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** All byte arrays in the arguments, moved (not copied) to the worker. */
function buffers(value: unknown, out: ArrayBuffer[] = []): ArrayBuffer[] {
  if (value instanceof Uint8Array) {
    if (value.byteOffset === 0 && value.byteLength === value.buffer.byteLength && value.buffer instanceof ArrayBuffer && !out.includes(value.buffer)) out.push(value.buffer);
  } else if (value instanceof ArrayBuffer) {
    if (!out.includes(value)) out.push(value);
  } else if (Array.isArray(value)) value.forEach((v) => buffers(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => buffers(v, out));
  return out;
}

function run<K extends Op>(op: K, args: Parameters<Core[K]>, progress?: (n: number) => void): ReturnType<Core[K]> {
  const w = getWorker();
  // Only merge reports progress; other operations have optional trailing parameters.
  if (!w) return (core[op] as (...a: unknown[]) => ReturnType<Core[K]>)(...args, ...(op === "merge" ? [progress] : []));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, progress });
    w.postMessage({ id, op, args }, buffers(args));
  }) as ReturnType<Core[K]>;
}

export const merge = (inputs: { bytes: Bytes; password?: string }[], onProgress?: (done: number) => void) => run("merge", [inputs], onProgress);
export const extract = (...a: Parameters<Core["extract"]>) => run("extract", a);
export const extractMany = (...a: Parameters<Core["extractMany"]>) => run("extractMany", a);
export const organize = (...a: Parameters<Core["organize"]>) => run("organize", a);
export const rotate = (...a: Parameters<Core["rotate"]>) => run("rotate", a);
export const compressLossless = (...a: Parameters<Core["compressLossless"]>) => run("compressLossless", a);
export const watermark = (...a: Parameters<Core["watermark"]>) => run("watermark", a);
export const pageNumbers = (...a: Parameters<Core["pageNumbers"]>) => run("pageNumbers", a);
export const placeImages = (...a: Parameters<Core["placeImages"]>) => run("placeImages", a);
export const protect = (...a: Parameters<Core["protect"]>) => run("protect", a);
export const unlock = (...a: Parameters<Core["unlock"]>) => run("unlock", a);
export const textToPdf = (...a: Parameters<Core["textToPdf"]>) => run("textToPdf", a);

// ------------------------------------------------------------------ compress

/** Turns every page into a JPEG: much smaller, but the text is no longer selectable. */
export async function compressRaster(
  bytes: Bytes,
  opts: { dpi: number; quality: number; password?: string },
  onProgress?: (done: number, total: number) => void,
): Promise<Bytes> {
  const src = await openPdf(bytes, opts.password);
  const out = await PDFDocument.create();
  try {
    for (let i = 1; i <= src.numPages; i++) {
      const page = await src.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const canvas = await renderPage(page, (vp.width * opts.dpi) / 72, { dpr: 1 });
      const jpg = await out.embedJpg(await (await canvasToBlob(canvas, "image/jpeg", opts.quality)).arrayBuffer());
      const p = out.addPage([vp.width, vp.height]);
      p.drawImage(jpg, { x: 0, y: 0, width: vp.width, height: vp.height });
      canvas.width = canvas.height = 0;
      page.cleanup();
      onProgress?.(i, src.numPages);
    }
  } finally {
    void src?.loadingTask.destroy();
  }
  return save(out);
}

// ------------------------------------------------------------- images → PDF

export type ImagePdfOptions = {
  pageSize: "a4" | "letter" | "fit";
  orientation: "auto" | "portrait" | "landscape";
  margin: "none" | "small" | "large";
};


/** Decodes an image (any browser-supported format, EXIF-rotated) to JPEG or PNG bytes. */
async function normalizeImage(file: Blob, maxSide = 3000): Promise<{ bytes: ArrayBuffer; png: boolean; w: number; h: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const png = file.type === "image/png";
  if (!png) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await canvasToBlob(canvas, png ? "image/png" : "image/jpeg", 0.9);
  canvas.width = canvas.height = 0;
  return { bytes: await blob.arrayBuffer(), png, w, h };
}

export async function imagesToPdf(images: Blob[], opts: ImagePdfOptions, onProgress?: (done: number) => void): Promise<Bytes> {
  const out = await PDFDocument.create();
  const margin = { none: 0, small: 20, large: 48 }[opts.margin];
  for (let i = 0; i < images.length; i++) {
    const img = await normalizeImage(images[i]);
    const embedded = img.png ? await out.embedPng(img.bytes) : await out.embedJpg(img.bytes);
    let pw: number, ph: number;
    if (opts.pageSize === "fit") {
      // 72 dpi equivalent of a 150 dpi photo keeps pages a sensible size.
      const k = 72 / 150;
      pw = img.w * k + margin * 2;
      ph = img.h * k + margin * 2;
    } else {
      const [a, b] = SIZES[opts.pageSize];
      const landscape = opts.orientation === "landscape" || (opts.orientation === "auto" && img.w > img.h);
      [pw, ph] = landscape ? [b, a] : [a, b];
    }
    const page = out.addPage([pw, ph]);
    const boxW = pw - margin * 2;
    const boxH = ph - margin * 2;
    const s = Math.min(boxW / img.w, boxH / img.h);
    const w = img.w * s;
    const h = img.h * s;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    onProgress?.(i + 1);
  }
  return save(out);
}


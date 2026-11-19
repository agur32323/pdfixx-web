"use client";

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

/** pdf.js loads lazily: it is large and only works in the browser. */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | undefined;

export function pdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return m;
  });
  return pdfjsPromise;
}

export class PasswordRequired extends Error {
  constructor(public wrong: boolean) {
    super(wrong ? "wrong password" : "password required");
  }
}

export async function openPdf(data: Blob | ArrayBuffer | Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data instanceof Uint8Array ? data.slice() : data);
  try {
    return await lib.getDocument({
      data: bytes,
      password,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      cMapUrl: "/pdfjs/cmaps/",
    }).promise;
  } catch (e) {
    if (e instanceof lib.PasswordException) {
      throw new PasswordRequired(e.code === lib.PasswordResponses.INCORRECT_PASSWORD);
    }
    throw e;
  }
}

/** Renders a page into a new canvas at `width` CSS pixels (times the screen density). */
export async function renderPage(
  page: PDFPageProxy,
  width: number,
  opts: { rotation?: number; dpr?: number; canvas?: HTMLCanvasElement; signal?: AbortSignal } = {},
): Promise<HTMLCanvasElement> {
  const dpr = opts.dpr ?? Math.min(window.devicePixelRatio || 1, 2.5);
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + (opts.rotation ?? 0)) % 360 });
  const viewport = page.getViewport({ scale: (width / base.width) * dpr, rotation: base.rotation });
  const canvas = opts.canvas ?? document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const task = page.render({ canvas, viewport });
  const abort = () => task.cancel();
  opts.signal?.addEventListener("abort", abort);
  try {
    await task.promise;
  } finally {
    opts.signal?.removeEventListener("abort", abort);
  }
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas export failed"))), type, quality),
  );
}

/** First-page preview for file cards. */
export async function pdfThumbnail(blob: Blob, width = 240): Promise<{ thumb: Blob; pages: number }> {
  const doc = await openPdf(blob);
  try {
    const page = await doc.getPage(1);
    const canvas = await renderPage(page, width, { dpr: 2 });
    return { thumb: await canvasToBlob(canvas, "image/jpeg", 0.8), pages: doc.numPages };
  } finally {
    void doc?.loadingTask.destroy();
  }
}

/** Plain text of every page, for search, read-aloud and the assistant. */
export async function pageTexts(doc: PDFDocumentProxy, maxPages = doc.numPages, onProgress?: (done: number) => void): Promise<string[]> {
  const out: string[] = [];
  for (let i = 1; i <= Math.min(maxPages, doc.numPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      if (item.hasEOL) text += "\n";
      else if (item.str && !item.str.endsWith(" ")) text += " ";
    }
    out.push(text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
    page.cleanup();
    onProgress?.(i);
  }
  return out;
}

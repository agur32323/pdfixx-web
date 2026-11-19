"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n";
import { renderPage } from "@/lib/pdf/render";

import { IconButton, Spinner } from "./ui";

/**
 * One page, rendered to fit the available width, with whatever overlay the
 * tool draws on top (signature box, drawing canvas). The overlay gets the
 * page's on-screen size.
 */
export function PageStage({
  doc,
  page,
  onPage,
  children,
  maxHeight = "min(70dvh, 900px)",
}: {
  doc: PDFDocumentProxy;
  page: number;
  onPage: (p: number) => void;
  children?: (size: { width: number; height: number }) => ReactNode;
  maxHeight?: string;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [avail, setAvail] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: el.clientWidth - 24, h: el.clientHeight - 24 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!avail || !canvasRef.current) return;
    const ac = new AbortController();
    (async () => {
      const p = await doc.getPage(page + 1);
      const vp = p.getViewport({ scale: 1 });
      const scale = Math.min(avail.w / vp.width, avail.h / vp.height);
      const width = Math.floor(vp.width * scale);
      const height = Math.floor(vp.height * scale);
      try {
        await renderPage(p, width, { canvas: canvasRef.current!, signal: ac.signal });
        if (!ac.signal.aborted) setSize({ width, height });
      } catch {
        // Cancelled by a newer render.
      }
    })();
    return () => ac.abort();
  }, [doc, page, avail]);

  return (
    <div className="grid gap-3">
      <div ref={box} className="relative grid w-full place-items-center rounded-3xl bg-surface-alt p-0" style={{ height: maxHeight }}>
        <div className="relative shadow-[0_2px_12px_rgb(16_24_40/0.12)]" style={size ? { width: size.width, height: size.height } : undefined}>
          <canvas ref={canvasRef} className="block bg-white" style={size ? { width: size.width, height: size.height } : { width: 0, height: 0 }} />
          {size && children?.(size)}
        </div>
        {!size && (
          <div className="absolute inset-0 grid place-items-center">
            <Spinner className="size-6" />
          </div>
        )}
      </div>
      {doc.numPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <IconButton label="‹" disabled={page === 0} onClick={() => onPage(page - 1)} className="border border-line bg-surface">
            <ChevronLeft className="size-5" />
          </IconButton>
          <span className="min-w-28 text-center text-[14px] font-semibold tabular-nums">{t("pageOf", { page: page + 1, total: doc.numPages })}</span>
          <IconButton label="›" disabled={page >= doc.numPages - 1} onClick={() => onPage(page + 1)} className="border border-line bg-surface">
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

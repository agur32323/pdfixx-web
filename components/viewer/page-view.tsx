"use client";

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { memo, useEffect, useRef, useState } from "react";

import { pdfjs } from "@/lib/pdf/render";

/**
 * One page of the reader: a placeholder of the right size that renders the
 * canvas and the selectable text layer when it comes near the screen, and
 * frees them again when it scrolls far away.
 */
export const PageView = memo(function PageView({
  doc,
  index,
  width,
  ratio,
  query,
  onRatio,
}: {
  doc: PDFDocumentProxy;
  index: number;
  width: number;
  /** Height / width, known once the page is loaded (first page's ratio until then). */
  ratio: number;
  query?: string;
  onRatio: (index: number, ratio: number) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [rendered, setRendered] = useState(false);
  const pageRef = useRef<PDFPageProxy | null>(null);

  useEffect(() => {
    const el = holder.current!;
    const io = new IntersectionObserver((entries) => setNear(entries[0].isIntersecting), { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) {
      // Free memory for pages far off screen.
      if (canvasRef.current) canvasRef.current.width = canvasRef.current.height = 0;
      if (textRef.current) textRef.current.replaceChildren();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors what was just freed in the DOM
      setRendered(false);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const lib = await pdfjs();
        const page = pageRef.current ?? (await doc.getPage(index + 1));
        pageRef.current = page;
        const base = page.getViewport({ scale: 1 });
        const r = base.height / base.width;
        if (Math.abs(r - ratio) > 0.001) onRatio(index, r);
        const scale = width / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current!;
        // Render off-screen first so the old image stays until the new one is ready.
        const off = document.createElement("canvas");
        off.width = Math.floor(viewport.width);
        off.height = Math.floor(viewport.height);
        const task = page.render({ canvas: off, viewport });
        ac.signal.addEventListener("abort", () => task.cancel());
        await task.promise;
        if (ac.signal.aborted) return;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext("2d")!.drawImage(off, 0, 0);
        off.width = off.height = 0;

        const text = textRef.current!;
        text.replaceChildren();
        text.style.setProperty("--total-scale-factor", String(scale));
        const layer = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport: page.getViewport({ scale }) });
        await layer.render();
        if (ac.signal.aborted) return;
        const end = document.createElement("div");
        end.className = "endOfContent";
        text.append(end);
        setRendered(true);
      } catch {
        // Cancelled or a broken page; the placeholder stays.
      }
    }, 60);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [near, width, doc, index, ratio, onRatio]);

  // Highlight search hits in the text layer.
  useEffect(() => {
    const text = textRef.current;
    if (!text || !rendered) return;
    const q = query?.trim().toLocaleLowerCase();
    text.querySelectorAll("span").forEach((s) => {
      s.classList.toggle("hit", !!q && q.length > 1 && (s.textContent ?? "").toLocaleLowerCase().includes(q));
    });
  }, [query, rendered]);

  const height = Math.round(width * ratio);
  return (
    <div
      ref={holder}
      data-page={index}
      className="relative mx-auto bg-white shadow-[0_1px_3px_rgb(16_24_40/0.1),0_8px_24px_-12px_rgb(16_24_40/0.2)]"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" style={{ width, height }} />
      <div ref={textRef} className="textLayer" />
      {!rendered && <div className="absolute inset-0 animate-pulse bg-[linear-gradient(180deg,transparent,rgb(16_24_40/0.03))]" />}
    </div>
  );
});

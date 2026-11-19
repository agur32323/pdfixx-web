"use client";

import { DraftingCompass, FileSpreadsheet, FileText, File as FileIcon, Image as ImageIcon, Lock, Presentation } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import { kindOf, type LibFile, library } from "@/lib/library";
import { openPdf, PasswordRequired, pdfThumbnail, renderPage } from "@/lib/pdf/render";

import { cx, useObjectUrl } from "./ui";

/** One render at a time keeps big documents from freezing the page. */
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

function OfficeIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["xls", "xlsx", "ods"].includes(ext)) return <FileSpreadsheet className="size-8 text-[#1d7044]" />;
  if (["ppt", "pptx", "odp"].includes(ext)) return <Presentation className="size-8 text-[#d24726]" />;
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return <FileText className="size-8 text-[#2b579a]" />;
  if (["dwg", "dxf", "dwf"].includes(ext)) return <DraftingCompass className="size-8 text-[color:var(--cad)]" />;
  return <FileIcon className="size-8 text-fg-3" />;
}

/** First-page preview of a library file, cached in IndexedDB. */
export function FileThumb({ file, className }: { file: LibFile; className?: string }) {
  const [thumb, setThumb] = useState<Blob | null>(null);
  const [locked, setLocked] = useState(false);
  const kind = kindOf(file);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (kind === "image") {
        const b = await library.blob(file.id);
        if (alive && b) setThumb(b);
        return;
      }
      if (kind !== "pdf") return;
      const cached = await library.thumb(file.id);
      if (cached) {
        if (alive) setThumb(cached);
        return;
      }
      const blob = await library.blob(file.id);
      if (!blob) return;
      try {
        const { thumb, pages } = await enqueue(() => pdfThumbnail(blob));
        await library.setThumb(file.id, thumb);
        if (!file.pages) void library.update(file.id, { pages });
        if (alive) setThumb(thumb);
      } catch (e) {
        if (alive && e instanceof PasswordRequired) setLocked(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [file.id, file.pages, kind]);

  const url = useObjectUrl(thumb);
  return (
    <div className={cx("relative grid place-items-center overflow-hidden bg-white", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={cx("size-full", kind === "image" ? "object-cover" : "object-contain object-top")} draggable={false} />
      ) : locked ? (
        <Lock className="size-7 text-fg-3" />
      ) : kind === "office" || kind === "other" ? (
        <OfficeIcon name={file.name} />
      ) : kind === "image" ? (
        <ImageIcon className="size-7 text-fg-3" />
      ) : (
        <div className="size-full animate-pulse bg-surface-alt" />
      )}
    </div>
  );
}

/** Opens a PDF for previews; reports a password prompt instead of failing. */
type DocState = { doc?: PDFDocumentProxy; needsPassword?: boolean; wrongPassword?: boolean; error?: boolean };

export function usePdfDoc(file: Blob | null | undefined, password?: string): DocState {
  const [state, setState] = useState<DocState & { file?: Blob; password?: string }>({});
  useEffect(() => {
    if (!file) return;
    let alive = true;
    let doc: PDFDocumentProxy | undefined;
    openPdf(file, password)
      .then((d) => {
        doc = d;
        if (alive) setState({ doc: d, file, password });
        else void d?.loadingTask.destroy();
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof PasswordRequired) setState({ needsPassword: true, wrongPassword: e.wrong, file, password });
        else setState({ error: true, file, password });
      });
    return () => {
      alive = false;
      void doc?.loadingTask.destroy();
    };
  }, [file, password]);
  // Results for a previous file are never shown for the current one.
  return file && state.file === file && state.password === password ? state : {};
}

/** A page preview rendered when it scrolls into view. */
export function PageThumb({
  doc,
  index,
  rotation = 0,
  className,
  width = 180,
}: {
  doc: PDFDocumentProxy;
  index: number;
  rotation?: number;
  className?: string;
  width?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<string>();
  const [ratio, setRatio] = useState(1.414);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let alive = true;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started) return;
        started = true;
        io.disconnect();
        void enqueue(async () => {
          if (!alive) return;
          const page = await doc.getPage(index + 1);
          const vp = page.getViewport({ scale: 1 });
          if (alive) setRatio(vp.height / vp.width);
          const canvas = await renderPage(page, width, { dpr: 2 });
          if (alive) setImg(canvas.toDataURL("image/jpeg", 0.8));
          canvas.width = canvas.height = 0;
          page.cleanup();
        });
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [doc, index, width]);

  const turned = rotation % 180 !== 0;
  return (
    <div
      ref={holder}
      className={cx("relative grid place-items-center overflow-hidden", className)}
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt=""
          draggable={false}
          className={cx(
            "max-w-none bg-white shadow-[0_1px_3px_rgb(16_24_40/0.12)] transition-transform duration-200 ease-[var(--ease-out)]",
            !turned && "max-h-full",
          )}
          style={{
            transform: `rotate(${rotation}deg)`,
            width: turned ? `${100 / ratio}%` : "100%",
          }}
        />
      ) : (
        <div className="size-full animate-pulse rounded-md bg-surface-alt" />
      )}
    </div>
  );
}

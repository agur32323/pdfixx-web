"use client";

import {
  ArrowLeft,
  Bookmark,
  Download,
  Ellipsis,
  LayoutGrid,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  Printer,
  Search,
  Share2,
  Sparkles,
  Square,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/lib/i18n";
import { type LibFile, library } from "@/lib/library";
import { openPdf, pageTexts, PasswordRequired } from "@/lib/pdf/render";
import { nightPref, readingPref, ttsRatePref, usePref } from "@/lib/prefs";
import { toolHref } from "@/lib/tools";

import { PageThumb } from "../thumbs";
import { downloadLib, PasswordSheet, shareLib, ToolChooser } from "../tool-kit";
import { ActionList, Button, cx, IconButton, Segmented, Sheet, Spinner, Switch } from "../ui";
import { PageView } from "./page-view";
import { useReadAloud } from "./read-aloud";

export function Viewer() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const startPage = Number(params.get("page") ?? 0);

  const [file, setFile] = useState<LibFile | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [password, setPassword] = useState<string>();
  const [needsPassword, setNeedsPassword] = useState<{ wrong: boolean } | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const [baseRatio, setBaseRatio] = useState(1.414);
  const [current, setCurrent] = useState(0);
  const [chrome, setChrome] = useState(true);
  const night = usePref(nightPref);
  const reading = usePref(readingPref);
  const rate = usePref(ttsRatePref);
  const bookmarks = reading[id]?.bookmarks ?? [];

  const [panel, setPanel] = useState<null | "pages" | "view" | "more" | "tools">(null);
  const [pagesTab, setPagesTab] = useState<"all" | "bookmarks">("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState("");
  const texts = useRef<Promise<string[]> | null>(null);
  const [results, setResults] = useState<{ page: number; snippet: string }[] | null>(null);

  // ---------------------------------------------------------- loading
  useEffect(() => {
    let alive = true;
    let opened: PDFDocumentProxy | undefined;
    (async () => {
      const meta = await library.file(id);
      const blob = meta && (await library.blob(id));
      if (!alive) return;
      if (!meta || !blob) {
        setFailed(true);
        return;
      }
      setFile(meta);
      try {
        opened = await openPdf(blob, password);
        if (!alive) return void opened.loadingTask.destroy();
        setNeedsPassword(null);
        const first = await opened.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setBaseRatio(vp.height / vp.width);
        setDoc(opened);
      } catch (e) {
        if (e instanceof PasswordRequired) setNeedsPassword({ wrong: e.wrong });
        else setFailed(true);
      }
    })();
    return () => {
      alive = false;
      void opened?.loadingTask.destroy();
    };
  }, [id, password]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  const getTexts = useCallback(() => (texts.current ??= doc ? pageTexts(doc) : Promise.resolve([])), [doc]);

  // Fit to width, with comfortable reading width on large screens.
  const fit = Math.min(Math.max(avail - 24, 200), 880);
  const pageWidth = Math.round(fit * zoom);
  const onRatio = useCallback((i: number, r: number) => setRatios((x) => (x[i] === r ? x : { ...x, [i]: r })), []);

  // --------------------------------------------------- page tracking
  const scrollTo = useCallback((page: number, smooth = false) => {
    const el = scroller.current?.querySelector(`[data-page="${page}"]`);
    el?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }, []);

  const restored = useRef(false);
  useEffect(() => {
    if (!doc || !avail || restored.current) return;
    restored.current = true;
    const saved = readingPref.get()[id];
    const target = startPage > 0 ? startPage - 1 : saved && saved.page > 1 ? saved.page - 1 : 0;
    if (target > 0) {
      requestAnimationFrame(() => scrollTo(Math.min(target, doc.numPages - 1)));
      if (!startPage) toast(t("readerResumed", { page: target + 1 }), { action: { label: t("readerFromStart"), onClick: () => scrollTo(0) } });
    }
  }, [doc, avail, id, startPage, scrollTo, t]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !doc) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mid = el.getBoundingClientRect().top + el.clientHeight * 0.35;
        const pages = el.querySelectorAll<HTMLElement>("[data-page]");
        let found = 0;
        for (const p of pages) {
          if (p.getBoundingClientRect().top <= mid) found = Number(p.dataset.page);
          else break;
        }
        setCurrent(found);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [doc]);

  useEffect(() => {
    if (!doc || !restored.current) return;
    readingPref.set((r) => ({ ...r, [id]: { ...r[id], page: current + 1, total: doc.numPages, at: Date.now() } }));
  }, [current, doc, id]);

  // Zoom with ctrl/cmd + / − and the trackpad pinch (ctrl+wheel).
  useEffect(() => {
    const clamp = (z: number) => Math.min(3, Math.max(0.5, Math.round(z * 100) / 100));
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "+" || e.key === "=") setZoom((z) => clamp(z + 0.15));
      else if (e.key === "-") setZoom((z) => clamp(z - 0.15));
      else if (e.key === "0") setZoom(1);
      else if (e.key === "f") setSearchOpen(true);
      else return;
      e.preventDefault();
    };
    const el = scroller.current;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z * (1 - e.deltaY * 0.01)));
    };
    window.addEventListener("keydown", onKey);
    el?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      el?.removeEventListener("wheel", onWheel);
    };
  }, [doc]);

  // Text selection → "Asistana sor".
  useEffect(() => {
    const onSel = () => {
      const s = document.getSelection();
      const text = s && !s.isCollapsed && scroller.current?.contains(s.anchorNode) ? s.toString().trim() : "";
      setSelection(text.length > 2 ? text : "");
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  // ---------------------------------------------------------- search
  useEffect(() => {
    const q = query.trim().toLocaleLowerCase();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      const all = await getTexts();
      if (!alive) return;
      const out: { page: number; snippet: string }[] = [];
      all.forEach((text, page) => {
        const flat = text.replace(/\s+/g, " ");
        const lower = flat.toLocaleLowerCase();
        let at = lower.indexOf(q);
        while (at >= 0 && out.length < 200) {
          out.push({ page, snippet: (at > 30 ? "…" : "") + flat.slice(Math.max(0, at - 30), at + q.length + 50) });
          at = lower.indexOf(q, at + q.length);
        }
      });
      setResults(out);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, getTexts]);

  // ----------------------------------------------------------- speech
  const tts = useReadAloud(getTexts, useCallback((p: number) => scrollTo(p, true), [scrollTo]), rate);
  const ttsLabel = {
    idle: "",
    preparing: t("ttsPreparing"),
    playing: t("ttsReading", { page: tts.state.page + 1 }),
    paused: t("ttsPaused", { page: tts.state.page + 1 }),
    finished: t("ttsFinished"),
    noText: t("ttsNoText"),
    failed: t("ttsFailed"),
  }[tts.state.status];
  const ttsActive = tts.state.status !== "idle";

  const toggleBookmark = () => {
    const on = bookmarks.includes(current + 1);
    readingPref.set((r) => {
      const prev = r[id] ?? { page: current + 1, total: doc?.numPages ?? 1, at: Date.now() };
      const list = on ? (prev.bookmarks ?? []).filter((b) => b !== current + 1) : [...(prev.bookmarks ?? []), current + 1].sort((a, b) => a - b);
      return { ...r, [id]: { ...prev, bookmarks: list } };
    });
    toast(on ? t("readerBookmarkRemoved") : t("readerBookmarkAdded", { page: current + 1 }));
  };

  const print = async () => {
    const blob = await library.blob(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow?.print();
      } catch {
        window.open(url, "_blank");
      }
    };
    document.body.append(frame);
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };

  const pages = useMemo(() => (doc ? Array.from({ length: doc.numPages }, (_, i) => i) : []), [doc]);
  const total = doc?.numPages ?? 0;
  const bookmarked = bookmarks.includes(current + 1);

  // ------------------------------------------------------------ render
  if (failed) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="mb-4 text-fg-2">{t("viewerLoadFailed")}</p>
          <Button onClick={() => router.push("/files")}>{t("filesTitle")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cx("fixed inset-0 flex flex-col bg-[#e9ebef]", night && "night bg-[#0b0c0f]")} data-theme-night={night || undefined}>
      {/* Top bar */}
      <header
        className={cx(
          "absolute inset-x-0 top-0 z-30 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl transition-transform duration-200 ease-[var(--ease-out)]",
          !chrome && "-translate-y-full",
        )}
      >
        <div className="flex h-14 items-center gap-1 px-2 md:px-4">
          <IconButton label={t("webBack")} onClick={() => (window.history.length > 1 ? router.back() : router.push("/files"))}>
            <ArrowLeft className="size-5 text-fg" />
          </IconButton>
          {searchOpen ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-alt px-3">
              <Search className="size-4 shrink-0 text-fg-3" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("viewerSearchHint")}
                enterKeyHint="search"
                className="h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-3"
              />
              {results && <span className="shrink-0 text-[12px] text-fg-2">{t("webSearchResults", { count: results.length })}</span>}
            </div>
          ) : (
            <div className="min-w-0 flex-1 px-1">
              <div className="truncate text-[15px] font-semibold">{file?.name}</div>
              {total > 0 && <div className="text-[12px] text-fg-2 tabular-nums">{t("pageIndicator", { current: current + 1, total })}</div>}
            </div>
          )}
          <IconButton
            label={t("viewerSearchHint")}
            onClick={() => {
              setSearchOpen((o) => !o);
              setQuery("");
            }}
          >
            {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </IconButton>
          <IconButton label="…" onClick={() => setPanel("more")}>
            <Ellipsis className="size-5" />
          </IconButton>
        </div>
        {searchOpen && results && results.length > 0 && (
          <div className="scroll-area max-h-[40dvh] border-t border-line px-2 py-1">
            {results.slice(0, 100).map((r, i) => (
              <button
                key={i}
                onClick={() => scrollTo(r.page)}
                className="press flex w-full items-baseline gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-alt"
              >
                <span className="shrink-0 text-[12px] font-bold text-brand tabular-nums">{r.page + 1}</span>
                <span className="truncate text-[14px] text-fg-2">{r.snippet}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Pages */}
      <div
        ref={scroller}
        className="scroll-area flex-1 overflow-x-auto"
        onClick={(e) => {
          if (window.matchMedia("(min-width: 768px)").matches) return;
          if (document.getSelection()?.toString()) return;
          if ((e.target as HTMLElement).closest("button,a")) return;
          setChrome((c) => !c);
        }}
      >
        {!doc ? (
          <div className="grid h-full place-items-center">
            <Spinner className="size-7" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-3 pt-[calc(72px+env(safe-area-inset-top,0px))] pb-[calc(96px+env(safe-area-inset-bottom,0px))]" style={{ minWidth: pageWidth + 24 }}>
            {pages.map((i) => (
              <PageView key={i} doc={doc} index={i} width={pageWidth} ratio={ratios[i] ?? baseRatio} query={searchOpen ? query : undefined} onRatio={onRatio} />
            ))}
          </div>
        )}
      </div>

      {/* Selection → assistant */}
      {selection && (
        <div className="enter absolute inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-40 flex justify-center">
          <Button
            variant="ai"
            icon={<Sparkles className="size-4" />}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => router.push(`${toolHref("ai")}?files=${id}&q=${encodeURIComponent(t("aiAskSelection", { text: selection.slice(0, 300) }))}`)}
          >
            {t("askAi")}
          </Button>
        </div>
      )}

      {/* Read-aloud bar */}
      {ttsActive && (
        <div className="enter absolute inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-30 mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4 shadow-float">
          <Volume2 className="size-5 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{ttsLabel}</span>
          <select
            aria-label={t("ttsSpeed")}
            value={rate}
            onChange={(e) => {
              ttsRatePref.set(Number(e.target.value));
              if (tts.state.status === "playing") void tts.start(tts.state.page);
            }}
            className="h-9 rounded-lg bg-surface-alt px-2 text-[14px] font-semibold"
          >
            {[0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
          {tts.state.status === "playing" ? (
            <IconButton label="⏸" onClick={tts.pause}>
              <Pause className="size-5" />
            </IconButton>
          ) : tts.state.status === "paused" ? (
            <IconButton label="▶" onClick={tts.resume}>
              <Play className="size-5" />
            </IconButton>
          ) : null}
          <IconButton label={t("close")} onClick={tts.stop}>
            <Square className="size-4" />
          </IconButton>
        </div>
      )}

      {/* Bottom bar */}
      <nav
        className={cx(
          "absolute inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl transition-transform duration-200 ease-[var(--ease-out)]",
          !chrome && "translate-y-full",
        )}
      >
        <div className="mx-auto flex h-[68px] max-w-xl items-stretch">
          {(
            [
              { icon: LayoutGrid, label: t("readerPages"), on: false, run: () => setPanel("pages") },
              { icon: Bookmark, label: t("readerBookmark"), on: bookmarked, run: toggleBookmark },
              { icon: Volume2, label: t("readerReadAloud"), on: ttsActive, run: () => (ttsActive ? tts.stop() : void tts.start(current)) },
              { icon: Moon, label: t("readerView"), on: night, run: () => setPanel("view") },
              { icon: Sparkles, label: t("askAi"), on: false, run: () => router.push(`${toolHref("ai")}?files=${id}`), ai: true },
            ] as const
          ).map((b) => (
            <button key={b.label} onClick={b.run} className="press flex flex-1 flex-col items-center justify-center gap-1">
              <b.icon className={cx("size-[22px]", b.on ? "fill-current text-brand" : "ai" in b ? "text-violet" : "text-fg-2")} strokeWidth={2} />
              <span className={cx("text-[11px] font-semibold", b.on ? "text-brand" : "ai" in b ? "text-violet" : "text-fg-2")}>{b.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Pages & bookmarks */}
      <Sheet open={panel === "pages"} onClose={() => setPanel(null)} title={t("readerPages")} wide>
        <Segmented
          className="mb-4"
          value={pagesTab}
          onChange={setPagesTab}
          options={[
            { value: "all", label: t("readerAllPages") },
            { value: "bookmarks", label: `${t("readerBookmarks")}${bookmarks.length ? ` (${bookmarks.length})` : ""}` },
          ]}
        />
        {pagesTab === "bookmarks" && !bookmarks.length ? (
          <p className="py-10 text-center text-[15px] text-fg-2">{t("readerNoBookmarks")}</p>
        ) : (
          doc && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {(pagesTab === "all" ? pages : bookmarks.map((b) => b - 1)).map((i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPanel(null);
                    scrollTo(i);
                  }}
                  className={cx("press relative rounded-2xl border bg-surface p-1.5", i === current ? "border-brand ring-4 ring-[color-mix(in_srgb,var(--brand)_14%,transparent)]" : "border-line")}
                >
                  <PageThumb doc={doc} index={i} width={150} />
                  {bookmarks.includes(i + 1) && <Bookmark className="absolute top-2.5 right-2.5 size-4 fill-brand text-brand" />}
                  <div className={cx("mt-1 text-center text-[12px] font-semibold tabular-nums", i === current ? "text-brand" : "text-fg-2")}>{i + 1}</div>
                </button>
              ))}
            </div>
          )
        )}
      </Sheet>

      {/* View options */}
      <Sheet open={panel === "view"} onClose={() => setPanel(null)} title={t("readerViewTitle")}>
        <div className="grid gap-5">
          <Switch checked={night} onChange={(v) => nightPref.set(v)} label={t("readerNight")} sub={t("readerNightSub")} />
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[15px] font-medium">{t("webFitWidth")}</span>
            <IconButton label={t("webZoomOut")} className="border border-line" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}>
              <Minus className="size-4" />
            </IconButton>
            <button className="press h-10 min-w-16 rounded-xl bg-surface-alt px-3 text-[14px] font-semibold tabular-nums" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <IconButton label={t("webZoomIn")} className="border border-line" onClick={() => setZoom((z) => Math.min(3, z + 0.15))}>
              <Plus className="size-4" />
            </IconButton>
          </div>
        </div>
      </Sheet>

      {/* More */}
      <Sheet open={panel === "more"} onClose={() => setPanel(null)} title={file?.name}>
        {file && (
          <ActionList
            items={[
              { icon: <Download className="size-5" />, label: t("download"), onClick: () => downloadLib(file) },
              { icon: <Share2 className="size-5" />, label: t("share"), onClick: () => shareLib([file], t) },
              { icon: <Printer className="size-5" />, label: t("webPrint"), onClick: () => void print() },
              { icon: <Sparkles className="size-5" />, label: t("askAi"), onClick: () => router.push(`${toolHref("ai")}?files=${id}`) },
              {
                icon: <Wrench className="size-5" />,
                label: t("openWithTool"),
                onClick: () => setPanel("tools"),
              },
            ]}
          />
        )}
      </Sheet>
      <ToolChooser open={panel === "tools"} onClose={() => setPanel(null)} fileIds={[id]} />

      <PasswordSheet
        open={!!needsPassword}
        name={file?.name ?? ""}
        wrong={!!needsPassword?.wrong}
        onSubmit={(p) => setPassword(p)}
        onClose={() => router.push("/files")}
      />
    </div>
  );
}

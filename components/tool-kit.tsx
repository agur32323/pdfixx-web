"use client";

import JSZip from "jszip";
import { BookOpen, Check, ChevronRight, Cloud, Download, FolderOpen, Home, Lock, Plus, Share2, ShieldCheck, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CloudError, type CloudStage } from "@/lib/cloud";
import { type T, useT } from "@/lib/i18n";
import { kindOf, type LibFile, library, useLibrary } from "@/lib/library";
import { isEncryptedFile, NeedsPassword, WrongPassword } from "@/lib/pdf/engine";
import { openPdf, PasswordRequired } from "@/lib/pdf/render";
import { cloudRemaining, cloudUsagePref, FREE_CLOUD_PER_DAY, FREE_MAX_MB, rememberTool, useHydrated, usePref } from "@/lib/prefs";
import { CATEGORIES, categoryColor, type ToolDef, toolHref, TOOLS } from "@/lib/tools";

import { AdSlot } from "./ad-slot";

import { FileThumb } from "./thumbs";
import { Button, cx, formatBytes, IconButton, IconTile, Sheet, TextInput } from "./ui";

// ------------------------------------------------------------- handing off

/** Files dropped on the home screen, waiting for the tool page to pick them up. */
let pending: File[] = [];
export function handOff(files: File[]) {
  pending = files;
}
function takePending(): File[] {
  const f = pending;
  pending = [];
  return f;
}

// ---------------------------------------------------------------- inputs

export type InputFile = {
  key: string;
  file: File;
  /** Set when the file came from Dosyalarım. */
  libId?: string;
  pages?: number;
  encrypted?: boolean;
  password?: string;
};

let seq = 0;
const nextKey = () => `in${++seq}`;

/** Reads page count and whether a PDF is password protected. */
export async function inspect(file: File, password?: string): Promise<{ pages?: number; encrypted: boolean; needsPassword: boolean }> {
  if (kindOf(file) !== "pdf") return { encrypted: false, needsPassword: false };
  try {
    const doc = await openPdf(file, password);
    const pages = doc.numPages;
    void doc?.loadingTask.destroy();
    return { pages, encrypted: !!password || (await isEncryptedFile(file)), needsPassword: false };
  } catch (e) {
    if (e instanceof PasswordRequired) return { encrypted: true, needsPassword: true };
    throw e;
  }
}

/**
 * Inputs for a tool: from the file dialog, a drop, Dosyalarım or a link
 * (?files=id,id). Asks for passwords of protected PDFs.
 */
export function useInputs(opts: { multiple?: boolean; needsPdf?: boolean } = {}) {
  const t = useT();
  const params = useSearchParams();
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [asking, setAsking] = useState<{ input: InputFile; wrong: boolean } | null>(null);
  const queue = useRef<InputFile[]>([]);
  const multiple = !!opts.multiple;

  const add = useCallback(
    async (files: File[], libIds: (string | undefined)[] = []) => {
      const list = multiple ? files : files.slice(0, 1);
      const prepared: InputFile[] = [];
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const input: InputFile = { key: nextKey(), file, libId: libIds[i] };
        try {
          const info = await inspect(file);
          Object.assign(input, { pages: info.pages, encrypted: info.encrypted });
          if (info.needsPassword) {
            queue.current.push(input);
            continue;
          }
        } catch {
          toast.error(t("errCorruptNamed", { name: file.name }));
          continue;
        }
        prepared.push(input);
      }
      setInputs((prev) => (multiple ? [...prev, ...prepared] : prepared.length ? prepared : prev));
      if (!asking && queue.current.length) setAsking({ input: queue.current.shift()!, wrong: false });
    },
    [multiple, t, asking],
  );

  const submitPassword = useCallback(
    async (password: string) => {
      if (!asking) return;
      try {
        const info = await inspect(asking.input.file, password);
        if (info.needsPassword) {
          setAsking({ input: asking.input, wrong: true });
          return;
        }
        const ready = { ...asking.input, pages: info.pages, encrypted: true, password };
        setInputs((prev) => (multiple ? [...prev, ready] : [ready]));
        const next = queue.current.shift();
        setAsking(next ? { input: next, wrong: false } : null);
      } catch (e) {
        if (e instanceof PasswordRequired) setAsking({ input: asking.input, wrong: true });
        else setAsking(null);
      }
    },
    [asking, multiple],
  );

  const skipPassword = useCallback(() => {
    const next = queue.current.shift();
    setAsking(next ? { input: next, wrong: false } : null);
  }, []);

  // Files passed in the URL or handed off from another screen.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const handed = takePending();
    if (handed.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading files handed over by another screen
      void add(handed);
      return;
    }
    const ids = params.get("files")?.split(",").filter(Boolean) ?? [];
    if (!ids.length) return;
    void (async () => {
      const files: File[] = [];
      const libIds: string[] = [];
      for (const id of ids) {
        const f = await library.asFile(id);
        if (f) {
          files.push(f);
          libIds.push(id);
        }
      }
      await add(files, libIds);
    })();
  }, [add, params]);

  const passwordSheet = (
    <PasswordSheet
      open={!!asking}
      name={asking?.input.file.name ?? ""}
      wrong={!!asking?.wrong}
      onSubmit={submitPassword}
      onClose={skipPassword}
    />
  );

  return { inputs, setInputs, add, passwordSheet };
}

export function PasswordSheet({
  open,
  name,
  wrong,
  onSubmit,
  onClose,
}: {
  open: boolean;
  name: string;
  wrong: boolean;
  onSubmit: (password: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("passwordRequiredTitle")}>
      <PasswordForm key={`${name}:${open}`} name={name} wrong={wrong} onSubmit={onSubmit} onClose={onClose} />
    </Sheet>
  );
}

function PasswordForm({ name, wrong, onSubmit, onClose }: { name: string; wrong: boolean; onSubmit: (password: string) => void; onClose: () => void }) {
  const t = useT();
  const [value, setValue] = useState("");
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value) onSubmit(value);
        }}
      >
        <div className="mb-4 flex items-start gap-3">
          <IconTile color="var(--security)">
            <Lock className="size-5" />
          </IconTile>
          <p className="text-[15px] text-fg-2">{t("passwordRequiredBody", { name })}</p>
        </div>
        <TextInput
          type="password"
          autoFocus
          autoComplete="off"
          placeholder={t("passwordHint")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={wrong}
          className={wrong ? "border-danger" : undefined}
          enterKeyHint="done"
        />
        {wrong && <p className="mt-2 text-[13px] text-danger">{t("errWrongPassword")}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={!value}>
            {t("unlockAction")}
          </Button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------- picking

function matches(accept: string, f: { name: string; type: string }) {
  return accept.split(",").some((a) => {
    const rule = a.trim().toLowerCase();
    if (rule.startsWith(".")) return f.name.toLowerCase().endsWith(rule);
    if (rule.endsWith("/*")) return f.type.startsWith(rule.slice(0, -1));
    return f.type === rule;
  });
}

/** The big drop area every tool starts with. */
export function DropZone({
  accept,
  multiple,
  onFiles,
  cloud,
  capture,
  compact,
  hint,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[], libIds?: string[]) => void;
  cloud?: boolean;
  capture?: boolean;
  compact?: boolean;
  hint?: string;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [picking, setPicking] = useState(false);
  const all = useLibrary();
  const hasLibraryFiles = (all ?? []).some((f) => matches(accept, f));

  const pickLabel = multiple ? (accept.includes("pdf") ? t("selectPdfs") : t("selectFile")) : accept.includes("pdf") ? t("selectPdf") : t("selectFile");

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const files = Array.from(e.dataTransfer.files).filter((f) => matches(accept, f));
          if (files.length) onFiles(files);
        }}
        className={cx(
          "relative grid place-items-center rounded-[28px] border-2 border-dashed text-center transition-colors duration-150",
          compact ? "px-5 py-8" : "px-6 py-12 md:py-16",
          over ? "border-brand bg-[color-mix(in_srgb,var(--brand)_6%,var(--surface))]" : "border-line bg-surface",
        )}
      >
        <div className="grid justify-items-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-brand">
            <Upload className="size-6" />
          </span>
          <div className="hidden text-[17px] font-bold md:block">{t("webDropTitle")}</div>
          <div className="mt-1 mb-4 hidden text-[13px] text-fg-3 md:block">{t("webDropOr")}</div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => input.current?.click()} icon={<Plus className="size-5" />}>
              {pickLabel}
            </Button>
            {hasLibraryFiles && (
              <Button size="lg" variant="secondary" onClick={() => setPicking(true)} icon={<FolderOpen className="size-5" />}>
                {t("pickFromLibrary")}
              </Button>
            )}
          </div>
          <p className="mt-5 max-w-sm text-center text-[13px] text-balance text-fg-3">
            {cloud ? <Cloud className="mr-1.5 inline size-4 align-[-3px]" /> : <ShieldCheck className="mr-1.5 inline size-4 align-[-3px] text-success" />}
            {hint ?? (cloud ? t("webDropHintCloud") : t("webDropHint"))}
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple={multiple}
          capture={capture ? "environment" : undefined}
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
      </div>
      <LibraryPicker open={picking} onClose={() => setPicking(false)} accept={accept} multiple={multiple} onPick={onFiles} />
    </>
  );
}

/** Choose files from Dosyalarım. */
export function LibraryPicker({
  open,
  onClose,
  accept,
  multiple,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  accept: string;
  multiple?: boolean;
  onPick: (files: File[], libIds: string[]) => void;
}) {
  const t = useT();
  const all = useLibrary();
  const files = useMemo(() => (all ?? []).filter((f) => matches(accept, f)), [all, accept]);
  const [sel, setSel] = useState<string[]>([]);
  const close = () => {
    setSel([]);
    onClose();
  };

  const finish = async (ids: string[]) => {
    const out: File[] = [];
    for (const id of ids) {
      const f = await library.asFile(id);
      if (f) out.push(f);
    }
    close();
    onPick(out, ids);
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("pickFromLibrary")}
      wide
      footer={
        multiple ? (
          <Button className="w-full" disabled={!sel.length} onClick={() => finish(sel)}>
            {t("addCount", { count: sel.length })}
          </Button>
        ) : undefined
      }
    >
      {files.length === 0 ? (
        <p className="py-10 text-center text-fg-2">{t("libraryEmptyForTool")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {files.map((f) => {
            const on = sel.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => (multiple ? setSel((s) => (on ? s.filter((x) => x !== f.id) : [...s, f.id])) : finish([f.id]))}
                className="press group text-left"
              >
                <div className={cx("relative overflow-hidden rounded-2xl border", on ? "border-brand ring-4 ring-[color-mix(in_srgb,var(--brand)_15%,transparent)]" : "border-line")}>
                  <FileThumb file={f} className="aspect-[3/4]" />
                  {multiple && (
                    <span
                      className={cx(
                        "absolute top-2 right-2 grid size-6 place-items-center rounded-full border-2",
                        on ? "border-brand bg-brand text-white" : "border-white/80 bg-black/10",
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 truncate text-[13px] font-medium">{f.name}</div>
                <div className="text-[12px] text-fg-3">{formatBytes(f.size, t.lang)}</div>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

/** A selected input shown as a row (name, size, pages, change/remove). */
export function InputRow({ input, onRemove, onChange, extra }: { input: InputFile; onRemove?: () => void; onChange?: () => void; extra?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-[11px] font-extrabold text-brand uppercase">
        {input.file.name.split(".").pop()?.slice(0, 4)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{input.file.name}</div>
        <div className="flex items-center gap-1.5 text-[13px] text-fg-2">
          {formatBytes(input.file.size, t.lang)}
          {input.pages != null && <> · {t("pagesCount", { count: input.pages })}</>}
          {input.encrypted && (
            <span className="inline-flex items-center gap-1 text-[color:var(--security)]">
              · <Lock className="size-3" /> {t("encrypted")}
            </span>
          )}
        </div>
      </div>
      {extra}
      {onChange && (
        <Button variant="ghost" size="sm" onClick={onChange}>
          {t("changeFile")}
        </Button>
      )}
      {onRemove && (
        <IconButton label={t("remove")} onClick={onRemove}>
          <X className="size-4" />
        </IconButton>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- jobs

export type Output = { blob: Blob; name: string };

export type JobControl = {
  stage: (text: string) => void;
  progress: (fraction: number | null) => void;
  signal: AbortSignal;
};

type JobState =
  | { kind: "idle" }
  | { kind: "running"; stage: string; progress: number | null }
  | { kind: "done"; outputs: LibFile[]; summary?: string }
  | { kind: "error"; message: string };

export class JobFailure extends Error {}

export function errorMessage(e: unknown, t: T): string {
  if (e instanceof JobFailure) return e.message;
  if (e instanceof WrongPassword) return t("errWrongPassword");
  if (e instanceof NeedsPassword) return t("passwordRequiredTitle");
  if (e instanceof CloudError) {
    return {
      noInternet: t("errNoInternet"),
      quota: t("errCloudQuota"),
      key: t("errCloudKey"),
      notConfigured: t("errCloudNotConfigured"),
      tooLarge: t("errTooLarge"),
      unsupported: t("errUnsupported"),
      server: t("errServer"),
      cancelled: t("jobCancelled"),
    }[e.code];
  }
  if (e instanceof DOMException && e.name === "AbortError") return t("jobCancelled");
  if (e instanceof RangeError) return t("errOutOfMemory");
  const msg = String((e as Error)?.message ?? "");
  if (/invalid pdf|failed to parse|no pdf header|invalidpdf/i.test(msg)) return t("errCorrupt");
  return t("errGeneric");
}

export function useJob(tool: ToolDef) {
  const t = useT();
  const [state, setState] = useState<JobState>({ kind: "idle" });
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(
    async (work: (c: JobControl) => Promise<{ outputs: Output[]; summary?: string }>) => {
      const ac = new AbortController();
      ctrl.current = ac;
      setState({ kind: "running", stage: t("processingStarting"), progress: null });
      rememberTool(tool.id);
      // Let the overlay paint before heavy work blocks the main thread.
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      try {
        const res = await work({
          stage: (stage) => setState((s) => (s.kind === "running" ? { ...s, stage } : s)),
          progress: (progress) => setState((s) => (s.kind === "running" ? { ...s, progress } : s)),
          signal: ac.signal,
        });
        if (ac.signal.aborted) throw new DOMException("aborted", "AbortError");
        const saved: LibFile[] = [];
        for (const o of res.outputs) saved.push(await library.add(o.blob, o.name));
        setState({ kind: "done", outputs: saved, summary: res.summary });
      } catch (e) {
        if (ac.signal.aborted) {
          setState({ kind: "idle" });
          toast(t("jobCancelled"));
        } else {
          if (!(e instanceof JobFailure)) console.error(e);
          setState({ kind: "error", message: errorMessage(e, t) });
        }
      }
    },
    [t, tool.id],
  );

  const cancel = () => ctrl.current?.abort();
  const reset = () => setState({ kind: "idle" });
  return { state, run, cancel, reset };
}

/** Builds an output name: "report.pdf" + "_compressed" → "report_compressed.pdf". */
export function outName(input: string, suffix: string, ext?: string) {
  const dot = input.lastIndexOf(".");
  const base = dot > 0 ? input.slice(0, dot) : input;
  const e = ext ?? (dot > 0 ? input.slice(dot + 1) : "pdf");
  return `${base}${suffix}.${e}`;
}

export const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: "application/pdf" });

// ---------------------------------------------------------------- sharing

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadLib(f: LibFile) {
  const blob = await library.blob(f.id);
  if (blob) downloadBlob(blob, f.name);
}

export async function shareLib(files: LibFile[], t: T) {
  const list: File[] = [];
  for (const f of files) {
    const file = await library.asFile(f.id);
    if (file) list.push(file);
  }
  if (navigator.canShare?.({ files: list })) {
    try {
      await navigator.share({ files: list });
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
  }
  for (const f of files) await downloadLib(f);
  toast(t("webShareFailed"));
}

export async function downloadZip(files: LibFile[], name: string) {
  const zip = new JSZip();
  for (const f of files) {
    const b = await library.blob(f.id);
    if (b) zip.file(f.name, b);
  }
  downloadBlob(await zip.generateAsync({ type: "blob" }), name);
}

// -------------------------------------------------------------- scaffold

/** Breadcrumb, title, the tool itself with a floating action bar, then how-to, related tools and an ad. */
export function ToolScaffold({
  tool,
  children,
  action,
  job,
  onNewFile,
}: {
  tool: ToolDef;
  children: ReactNode;
  action?: { label: string; onClick: () => void; disabled?: boolean; hint?: ReactNode };
  job: ReturnType<typeof useJob>;
  onNewFile?: () => void;
}) {
  const t = useT();
  const color = categoryColor(tool.category);
  const Icon = tool.icon;
  const st = job.state;
  const category = CATEGORIES.find((c) => c.id === tool.category);
  const done = st.kind === "done";

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: `radial-gradient(50% 120% at 50% 0%, color-mix(in srgb, ${color} 12%, transparent), transparent 70%)` }} />
        <div className="relative mx-auto max-w-4xl px-4 pt-8 pb-10 text-center md:pt-12 md:pb-14">
          <nav className="mb-6 flex items-center justify-center gap-1.5 text-[13px] text-fg-3">
            <Link href="/#tools" className="hover:text-fg">
              {t("webNavTools")}
            </Link>
            <ChevronRight className="size-3.5" />
            <span>{category ? t(category.title) : t("catAi")}</span>
          </nav>
          <div className="flex justify-center">
            <IconTile color={color} size={60}>
              <Icon className="size-[30px]" />
            </IconTile>
          </div>
          <h1 className="font-display mt-5 text-[34px] leading-[1.08] font-extrabold tracking-[-0.035em] md:text-[48px]">{t(tool.title)}</h1>
          <p className="mx-auto mt-3 max-w-xl text-[16px] text-fg-2 md:text-[18px]">{t(tool.sub)}</p>
          <span
            className={cx(
              "mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold",
              tool.cloud ? "bg-[color-mix(in_srgb,var(--from-pdf)_10%,transparent)] text-[color:var(--from-pdf)]" : "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-success",
            )}
          >
            {tool.cloud ? <Cloud className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
            {tool.cloud ? t("webBadgeCloud") : t("webBadgeLocal")}
          </span>
        </div>
      </section>

      <div className="mx-auto w-full max-w-4xl px-4 pt-8 md:pt-10">
        {done ? (
          <ResultView
            tool={tool}
            outputs={st.outputs}
            summary={st.summary}
            onAgain={() => {
              job.reset();
              onNewFile?.();
            }}
          />
        ) : (
          <>
            {children}
            {st.kind === "error" && (
              <div className="enter mt-4 rounded-2xl border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] p-4 text-[15px] text-danger">
                <div className="font-semibold">{t("errTitle")}</div>
                <div className="mt-0.5 text-[14px]">{st.message}</div>
              </div>
            )}
            {action && (
              <div className="sticky bottom-0 z-30 -mx-4 mt-6 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] md:bottom-4 md:mx-0 md:px-0 md:pb-0">
                <div className="flex flex-col items-stretch gap-3 rounded-[22px] border border-line bg-surface/90 p-2.5 shadow-float backdrop-blur-xl sm:flex-row sm:items-center sm:pl-5">
                  {action.hint && <div className="min-w-0 flex-1 text-center text-[13px] text-fg-2 sm:text-left">{action.hint}</div>}
                  <Button size="lg" className={cx("w-full", !!action.hint && "sm:w-auto sm:min-w-56")} onClick={action.onClick} disabled={action.disabled || st.kind === "running"}>
                    {action.label}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AdSlot className="mt-16 px-4" />
      <ToolInfo tool={tool} />

      {st.kind === "running" && <JobOverlay stage={st.stage} progress={st.progress} cloud={tool.cloud} onCancel={job.cancel} />}
    </div>
  );
}

/** Under every tool: a short how-to and related tools (useful for people and search engines). */
function ToolInfo({ tool }: { tool: ToolDef }) {
  const t = useT();
  const related = [...TOOLS.filter((x) => x.category === tool.category && x.id !== tool.id), ...TOOLS.filter((x) => ["merge", "compress", "ai", "pdf_word", "sign"].includes(x.id) && x.category !== tool.category && x.id !== tool.id)].slice(0, 6);
  const steps = [
    [t("webStep1"), t("webStep1Sub")],
    [t("webStep2"), t("webStep2Sub")],
    [t("webStep3"), t("webStep3Sub")],
  ];
  return (
    <div className="mx-auto mt-16 grid max-w-6xl gap-16 px-4 md:px-8">
      <section>
        <h2 className="font-display text-center text-[26px] font-extrabold tracking-[-0.03em] md:text-[32px]">{t("webHowTo", { tool: t(tool.title) })}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="rounded-[22px] border border-line bg-surface p-6">
              <span className="grid size-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[14px] font-bold text-brand">{i + 1}</span>
              <div className="mt-4 text-[16px] font-bold">{title}</div>
              <p className="mt-1 text-[14px] leading-relaxed text-fg-2">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-6 max-w-2xl text-center text-[14px] text-fg-3">{tool.cloud ? t("cloudNote") : t("offlineNote")}</p>
      </section>
      <section>
        <h2 className="mb-6 text-[20px] font-bold tracking-[-0.02em]">{t("webRelated")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((x) => {
            const Icon = x.icon;
            return (
              <Link key={x.id} href={toolHref(x)} className="press lift flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4">
                <IconTile color={categoryColor(x.category)} size={40}>
                  <Icon className="size-5" />
                </IconTile>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold">{t(x.title)}</span>
                  <span className="block truncate text-[13px] text-fg-2">{t(x.sub)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function JobOverlay({ stage, progress, cloud, onCancel }: { stage: string; progress: number | null; cloud?: boolean; onCancel: () => void }) {
  const t = useT();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-6 backdrop-blur-sm">
      <div className="sheet-panel w-full max-w-sm rounded-[28px] border border-line bg-surface p-6 text-center shadow-float">
        <div className="relative mx-auto mb-5 size-16">
          <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 28}
              strokeDashoffset={progress == null ? 2 * Math.PI * 28 * 0.72 : 2 * Math.PI * 28 * (1 - progress)}
              className={cx(progress == null && "origin-center animate-spin [animation-duration:900ms]", "transition-[stroke-dashoffset] duration-300")}
            />
          </svg>
          {progress != null && <span className="absolute inset-0 grid place-items-center text-[13px] font-bold tabular-nums">{Math.round(progress * 100)}%</span>}
        </div>
        <div className="text-[17px] font-bold">{stage}</div>
        <p className="mt-1 min-h-[20px] text-[13px] text-fg-2">{slow ? (cloud ? t("processingSlowCloud") : t("processingSlow")) : ""}</p>
        <Button variant="secondary" className="mt-5 w-full" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

function ResultView({ tool, outputs, summary, onAgain }: { tool: ToolDef; outputs: LibFile[]; summary?: string; onAgain: () => void }) {
  const t = useT();
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const first = outputs[0];
  const total = outputs.reduce((n, f) => n + f.size, 0);
  const isPdf = first && kindOf(first) === "pdf";

  return (
    <div ref={(el) => el?.scrollIntoView({ block: "center", behavior: "smooth" })} className="mx-auto flex w-full max-w-2xl scroll-mt-24 flex-col rounded-[28px] border border-line bg-surface p-5 shadow-card md:p-10">
      <div className="enter text-center">
        <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success">
          <Check className="size-8" strokeWidth={3} />
        </span>
        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">{t("resultTitle")}</h1>
        <p className="mt-1 text-[15px] text-fg-2">
          {summary ?? (outputs.length > 1 ? t("filesCreated", { count: outputs.length, size: formatBytes(total, t.lang) }) : first && formatBytes(first.size, t.lang))}
        </p>
      </div>

      <div className="enter mt-8 grid gap-2">
        {outputs.slice(0, 6).map((f) => (
          <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 pr-3">
            <FileThumb file={f} className="h-14 w-11 shrink-0 rounded-lg border border-line" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{f.name}</div>
              <div className="text-[13px] text-fg-2">{formatBytes(f.size, t.lang)}</div>
            </div>
            <IconButton label={t("download")} onClick={() => downloadLib(f)}>
              <Download className="size-5" />
            </IconButton>
          </div>
        ))}
        {outputs.length > 6 && <p className="px-2 text-[13px] text-fg-2">{t("andMore", { count: outputs.length - 6 })}</p>}
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-fg-3">
        <FolderOpen className="size-4" /> {t("webSaved")}
      </p>

      <div className="mt-8 grid gap-3">
        <Button
          size="lg"
          icon={<Download className="size-5" />}
          onClick={() => (outputs.length > 1 ? downloadZip(outputs, `${t(tool.title)}.zip`) : downloadLib(first))}
        >
          {outputs.length > 1 ? t("webDownloadAll") : t("download")}
        </Button>
        <div className="grid grid-cols-2 gap-3">
          {isPdf && outputs.length === 1 ? (
            <Button variant="secondary" icon={<BookOpen className="size-5" />} onClick={() => router.push(`/view?id=${first.id}`)}>
              {t("open")}
            </Button>
          ) : (
            <Button variant="secondary" icon={<Share2 className="size-5" />} onClick={() => shareLib(outputs, t)}>
              {t("share")}
            </Button>
          )}
          {isPdf ? (
            <Button variant="secondary" icon={<ChevronRight className="size-5" />} onClick={() => setChoosing(true)}>
              {t("continueWith")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onAgain}>
              {t(tool.title)}
            </Button>
          )}
        </div>
        {isPdf && outputs.length === 1 && (
          <Button variant="ghost" icon={<Share2 className="size-5" />} onClick={() => shareLib(outputs, t)}>
            {t("share")}
          </Button>
        )}
        <Link href="/" className="press mx-auto mt-2 inline-flex items-center gap-2 text-[15px] font-semibold text-fg-2 hover:text-fg">
          <Home className="size-4" /> {t("backToHome")}
        </Link>
      </div>

      <ToolChooser open={choosing} onClose={() => setChoosing(false)} fileIds={outputs.map((o) => o.id)} exclude={tool.id} />
    </div>
  );
}

/** "Bu dosyayla devam et": pick another tool for these files. */
export function ToolChooser({ open, onClose, fileIds, exclude }: { open: boolean; onClose: () => void; fileIds: string[]; exclude?: string }) {
  const t = useT();
  const router = useRouter();
  const tools = TOOLS.filter((x) => x.accept.includes("pdf") && x.id !== exclude);
  return (
    <Sheet open={open} onClose={onClose} title={t("chooseTool")} wide>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tools.map((x) => {
          const Icon = x.icon;
          return (
            <button
              key={x.id}
              onClick={() => {
                onClose();
                router.push(`${toolHref(x)}?files=${fileIds.join(",")}`);
              }}
              className="press flex items-center gap-3 rounded-2xl border border-line p-3 text-left hover:bg-surface-alt"
            >
              <IconTile color={categoryColor(x.category)} size={36}>
                <Icon className="size-[18px]" />
              </IconTile>
              <span className="min-w-0 text-[14px] leading-tight font-semibold">{t(x.title)}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/** "Add more" buttons: the system file dialog plus Dosyalarım. */
export function AddMore({ accept, multiple = true, onFiles, label, capture }: { accept: string; multiple?: boolean; onFiles: (files: File[], libIds?: string[]) => void; label?: string; capture?: boolean }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const all = useLibrary();
  const hasLibraryFiles = (all ?? []).some((f) => matches(accept, f));
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" icon={<Plus className="size-5" />} onClick={() => input.current?.click()}>
        {label ?? t("addMore")}
      </Button>
      {hasLibraryFiles && (
        <Button variant="ghost" icon={<FolderOpen className="size-5" />} onClick={() => setPicking(true)}>
          {t("pickFromLibrary")}
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture ? "environment" : undefined}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <LibraryPicker open={picking} onClose={() => setPicking(false)} accept={accept} multiple={multiple} onPick={onFiles} />
    </div>
  );
}

/** Card wrapper for a group of options. */
export function OptionCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card p-4 md:p-5">
      {title && <h2 className="mb-3 text-[13px] font-bold tracking-wide text-fg-2 uppercase">{title}</h2>}
      {children}
    </section>
  );
}

/** Free-plan checks before a cloud job, as in the app (5 a day, 100 MB). */
export function checkCloud(file: File, t: T) {
  if (file.size > FREE_MAX_MB * 1024 * 1024) throw new JobFailure(t("webLargeFile", { mb: FREE_MAX_MB }));
  if (cloudRemaining() <= 0) throw new JobFailure(t("webCloudLimit", { count: FREE_CLOUD_PER_DAY }));
}

export function CloudRemaining() {
  const t = useT();
  usePref(cloudUsagePref);
  const hydrated = useHydrated();
  if (!hydrated) return null;
  const left = cloudRemaining();
  return (
    <p className={cx("flex items-center gap-1.5 text-[13px]", left > 0 ? "text-fg-2" : "text-danger")}>
      <Cloud className="size-4" /> {t("proCloudRemaining", { count: Math.max(0, left) })}
    </p>
  );
}

export function cloudStage(t: T) {
  return (s: CloudStage) => ({ connect: t("stageConnect"), upload: t("stageUpload"), process: t("stageProcess"), download: t("stageDownload") })[s];
}

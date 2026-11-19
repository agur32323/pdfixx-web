"use client";

import { ArrowUp, BookOpen, Copy, FileDown, Languages, ListChecks, Lightbulb, RotateCcw, ShieldCheck, Sparkles, Square, Text } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { type AiAction, type AiDocument, AiError, type AiFailure, type AiTurn, ask, CITATION, citationPages, prepareDocument, splitAnswer } from "@/lib/ai";
import { type T, useT } from "@/lib/i18n";
import { library } from "@/lib/library";
import { textToPdf } from "@/lib/pdf/engine";
import { aiConsentPref, usePref } from "@/lib/prefs";
import type { ToolDef } from "@/lib/tools";

import { DropZone, InputRow, pdfBlob, useInputs } from "../tool-kit";
import { Button, cx, Field, IconButton, Sheet, Spinner, TextInput } from "../ui";

type Msg = { role: "user" | "assistant"; text: string; followUps?: string[]; error?: string; streaming?: boolean; notice?: string; userText?: string };

function failureText(f: AiFailure, pro: boolean, t: T) {
  return {
    quota: pro ? t("aiErrQuotaPro") : t("webAiQuota"),
    noText: t("aiErrNoText"),
    scannedTooLarge: t("aiErrScanTooLarge"),
    tooLarge: t("aiErrTooLarge"),
    busy: t("aiErrBusy"),
    offline: t("errNoInternet"),
    unavailable: t("aiErrUnavailable"),
    refused: t("aiErrRefused"),
    generic: t("aiErrGeneric"),
  }[f];
}

/** Answer text with "(s. 4)" citations turned into page links. */
function AnswerText({ text, fileId }: { text: string; fileId?: string }) {
  const t = useT();
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(CITATION)) {
    parts.push(text.slice(last, m.index));
    const pages = citationPages(m[0]);
    parts.push(
      <span key={m.index} className="inline-flex flex-wrap gap-1 align-baseline">
        {pages.map((p) =>
          fileId ? (
            <Link
              key={p}
              href={`/view?id=${fileId}&page=${p}`}
              className="press inline-flex h-6 items-center rounded-full bg-[color-mix(in_srgb,var(--violet)_12%,transparent)] px-2 text-[12px] font-bold text-violet hover:bg-[color-mix(in_srgb,var(--violet)_20%,transparent)]"
            >
              {t("aiPageLink", { page: p })}
            </Link>
          ) : (
            <span key={p} className="text-[12px] font-bold text-violet">
              {t("aiPageLink", { page: p })}
            </span>
          ),
        )}
      </span>,
    );
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{parts}</div>;
}

const LANGS = ["langEnglish", "langTurkish", "langGerman", "langFrench", "langSpanish", "langArabic", "langRussian"] as const;

export default function Assistant({ tool }: { tool: ToolDef }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const consent = usePref(aiConsentPref);
  const [doc, setDoc] = useState<AiDocument | null>(null);
  const [fileId, setFileId] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [history, setHistory] = useState<AiTurn[]>([]);
  const [remaining, setRemaining] = useState<number>();
  const [question, setQuestion] = useState(params.get("q") ?? "");
  const [busy, setBusy] = useState(false);
  const [askConsent, setAskConsent] = useState<(() => void) | null>(null);
  const [translating, setTranslating] = useState(false);
  const [target, setTarget] = useState<(typeof LANGS)[number]>(t.lang === "tr" ? "langEnglish" : "langTurkish");
  const [range, setRange] = useState("");
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // Prepare the document as soon as one is chosen.
  useEffect(() => {
    if (!input) {
      setDoc(null);
      setMsgs([]);
      setHistory([]);
      return;
    }
    let alive = true;
    setPreparing(true);
    setPrepError(null);
    (async () => {
      try {
        const id = input.libId ?? (await library.add(input.file, input.file.name)).id;
        if (alive) setFileId(id);
        const d = await prepareDocument(input.file, input.password);
        if (alive) setDoc(d);
      } catch (e) {
        if (alive) setPrepError(e instanceof AiError ? failureText(e.failure, e.pro, t) : t("errCorrupt"));
      } finally {
        if (alive) setPreparing(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [input, t]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const withConsent = (fn: () => void) => (consent ? fn() : setAskConsent(() => fn));

  const send = (action: AiAction, label: string, extra: { question?: string; targetLanguage?: string; pageRange?: string } = {}) =>
    withConsent(async () => {
      if (!doc || busy) return;
      setBusy(true);
      setMsgs((m) => [...m, { role: "user", text: label }, { role: "assistant", text: "", streaming: true }]);
      const ac = new AbortController();
      abort.current = ac;
      let raw = "";
      const update = (patch: Partial<Msg>) =>
        setMsgs((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
          return copy;
        });
      try {
        const res = await ask(doc, {
          action,
          history,
          uiLanguage: t.lang,
          ...extra,
          signal: ac.signal,
          onDelta: (d) => {
            raw += d;
            update({ text: splitAnswer(raw).text });
          },
        });
        if (res.stopped) {
          update({ streaming: false, notice: t("aiStopped"), text: splitAnswer(raw).text });
        } else {
          const { text, followUps } = splitAnswer(res.text || raw);
          update({ streaming: false, text, followUps, notice: res.truncated ? t("aiTruncatedAnswer") : undefined, userText: res.userText });
          setHistory((h) => [...h, { role: "user", text: res.userText }, { role: "assistant", text: res.text }]);
        }
        if (res.remaining != null) setRemaining(res.remaining);
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError("generic");
        if (err.failure === "quota") setRemaining(0);
        update({ streaming: false, text: "", error: failureText(err.failure, err.pro, t) });
      } finally {
        setBusy(false);
        abort.current = null;
      }
    });

  const submit = () => {
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    send("chat", q, { question: q });
  };

  const saveAsPdf = async (text: string) => {
    const date = new Date().toLocaleDateString(t.lang === "tr" ? "tr-TR" : "en-US");
    const bytes = await textToPdf(t("aiPdfTitle", { file: doc!.name.replace(/\.pdf$/i, "") }), t("aiPdfSubtitle", { date }), text);
    const saved = await library.add(pdfBlob(bytes), `${doc!.name.replace(/\.pdf$/i, "")} – ${t("toolAi")}.pdf`);
    toast.success(t("aiSavedPdf"), { action: { label: t("open"), onClick: () => router.push(`/view?id=${saved.id}`) } });
  };

  const actions = [
    { icon: Text, label: t("aiSummary"), run: () => send("summary", t("aiSummary")) },
    { icon: ListChecks, label: t("aiKeypoints"), run: () => send("keypoints", t("aiKeypoints")) },
    { icon: Lightbulb, label: t("aiExplain"), run: () => send("chat", t("aiExplain"), { question: t("aiExplainPrompt") }) },
    { icon: Languages, label: t("aiTranslate"), run: () => setTranslating(true) },
  ];

  if (!input) {
    return (
      <div>
        <section className="relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_120%_at_50%_0%,rgb(109_59_245/0.16),transparent_70%)]" />
          <div className="relative mx-auto max-w-4xl px-4 pt-12 pb-12 text-center md:pt-16 md:pb-16">
            <span className="ai-gradient mx-auto grid size-[60px] place-items-center rounded-[18px] text-white shadow-[0_12px_28px_-12px_rgb(109_59_245/0.8)]">
              <Sparkles className="size-7" />
            </span>
            <h1 className="font-display mt-5 text-[34px] leading-[1.08] font-extrabold tracking-[-0.035em] md:text-[52px]">
              <span className="bg-[linear-gradient(100deg,var(--violet),#c03fb0_60%,var(--brand))] bg-clip-text text-transparent">{t("toolAi")}</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[16px] leading-relaxed text-fg-2 md:text-[18px]">{t("webAssistantSub")}</p>
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 pt-10">
          <DropZone accept={tool.accept} onFiles={add} cloud hint={t("webAiDropHint")} />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Text, title: t("aiSummary"), body: t("aiSuggestion1") },
              { icon: ListChecks, title: t("aiKeypoints"), body: t("aiSuggestion2") },
              { icon: Languages, title: t("aiTranslate"), body: `${t("langEnglish")}, ${t("langGerman")}, ${t("langArabic")}…` },
            ].map((c) => (
              <div key={c.title} className="rounded-[20px] border border-line bg-surface p-5">
                <c.icon className="size-5 text-violet" />
                <div className="mt-3 text-[15px] font-bold">{c.title}</div>
                <div className="mt-1 text-[13px] text-fg-2">{c.body}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[13px] text-fg-3">{t("aiDisclaimer")}</p>
        </div>
        {passwordSheet}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-64px)] w-full max-w-4xl flex-col md:my-10 md:h-[min(84dvh,880px)] md:overflow-hidden md:rounded-[28px] md:border md:border-line md:bg-surface/60 md:shadow-card">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-6">
        <span className="ai-gradient grid size-9 place-items-center rounded-xl text-white">
          <Sparkles className="size-[18px]" />
        </span>
        <h1 className="min-w-0 flex-1 truncate text-[18px] font-bold tracking-[-0.01em]">{t("toolAi")}</h1>
        {msgs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="size-4" />}
            onClick={() => {
              abort.current?.abort();
              setMsgs([]);
              setHistory([]);
            }}
          >
            {t("aiNewChat")}
          </Button>
        )}
      </header>

      <div className="scroll-area min-h-0 flex-1 px-4 pb-4 md:px-6">
        {!input ? (
          <div className="pt-4">
            <p className="mb-5 max-w-xl text-[15px] leading-relaxed text-fg-2">{t("webAssistantSub")}</p>
            <DropZone accept={tool.accept} onFiles={add} cloud />
          </div>
        ) : (
          <div className="grid gap-4 pt-2">
            <InputRow input={input} onChange={() => setInputs([])} extra={fileId && (
              <IconButton label={t("open")} onClick={() => router.push(`/view?id=${fileId}`)}>
                <BookOpen className="size-5" />
              </IconButton>
            )} />

            {preparing && (
              <div className="flex items-center gap-3 rounded-2xl bg-surface-alt p-4 text-[15px] text-fg-2">
                <Spinner className="size-5" /> {t("aiReading")}
              </div>
            )}
            {prepError && <div className="rounded-2xl bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] p-4 text-[15px] text-danger">{prepError}</div>}

            {doc && (
              <div className="enter rounded-3xl rounded-tl-lg bg-surface p-4 shadow-card">
                <p className="text-[15px]">{t("aiIntro", { pages: doc.totalPages })}</p>
                {doc.pdfBase64 && <p className="mt-1 text-[13px] text-fg-2">{t("aiIntroVisual")}</p>}
                {doc.truncated && <p className="mt-1 text-[13px] text-fg-2">{t("aiTruncated", { included: doc.pages?.length ?? 0, total: doc.totalPages })}</p>}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {actions.map((a) => (
                    <button
                      key={a.label}
                      disabled={busy}
                      onClick={a.run}
                      className="press flex h-12 items-center gap-2 rounded-2xl border border-line px-3 text-[14px] font-semibold hover:bg-surface-alt disabled:opacity-50"
                    >
                      <a.icon className="size-[18px] text-violet" />
                      {a.label}
                    </button>
                  ))}
                </div>
                {!msgs.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[t("aiSuggestion1"), t("aiSuggestion2")].map((s) => (
                      <button key={s} onClick={() => send("chat", s, { question: s })} className="press rounded-full bg-surface-alt px-3 py-1.5 text-[13px] font-medium text-fg-2 hover:text-fg">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="enter ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-violet px-4 py-2.5 text-[15px] text-white">
                  {m.text}
                </div>
              ) : (
                <div key={i} className="enter max-w-[95%] rounded-3xl rounded-tl-lg bg-surface p-4 shadow-card">
                  {m.error ? (
                    <p className="text-[15px] text-danger">{m.error}</p>
                  ) : m.streaming && !m.text ? (
                    <span className="inline-flex gap-1 py-2">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="size-2 animate-bounce rounded-full bg-violet/60" style={{ animationDelay: `${d * 120}ms` }} />
                      ))}
                    </span>
                  ) : (
                    <AnswerText text={m.text} fileId={fileId} />
                  )}
                  {m.notice && <p className="mt-2 text-[13px] text-fg-3">{m.notice}</p>}
                  {!m.streaming && m.text && (
                    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Copy className="size-4" />}
                        onClick={async () => {
                          await navigator.clipboard.writeText(m.text);
                          toast.success(t("aiCopied"));
                        }}
                      >
                        {t("aiCopy")}
                      </Button>
                      <Button variant="ghost" size="sm" icon={<FileDown className="size-4" />} onClick={() => saveAsPdf(m.text)}>
                        {t("aiSavePdf")}
                      </Button>
                    </div>
                  )}
                  {m.followUps && m.followUps.length > 0 && i === msgs.length - 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.followUps.map((f) => (
                        <button key={f} onClick={() => send("chat", f, { question: f })} className="press rounded-full border border-line px-3 py-1.5 text-left text-[13px] font-medium text-fg-2 hover:bg-surface-alt hover:text-fg">
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            <div ref={end} />
          </div>
        )}
      </div>

      {doc && (
        <div className="border-t border-line bg-bg/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] backdrop-blur-xl md:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-end gap-2 rounded-[24px] border border-line bg-surface p-1.5 pl-4 focus-within:border-violet"
          >
            <textarea
              rows={1}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={t("aiAskHint")}
              enterKeyHint="send"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 outline-none placeholder:text-fg-3 [field-sizing:content]"
            />
            {busy ? (
              <IconButton label={t("aiStop")} className="bg-fg text-bg hover:bg-fg hover:text-bg" onClick={() => abort.current?.abort()}>
                <Square className="size-4 fill-current" />
              </IconButton>
            ) : (
              <IconButton label={t("aiAskHint")} type="submit" disabled={!question.trim()} className="ai-gradient text-white hover:text-white disabled:opacity-40">
                <ArrowUp className="size-5" />
              </IconButton>
            )}
          </form>
          <p className="mt-2 text-center text-[12px] text-fg-3">
            {remaining != null && <>{t("aiRemaining", { count: remaining })} · </>}
            {t("aiDisclaimer")}
          </p>
        </div>
      )}

      <Sheet open={!!askConsent} onClose={() => setAskConsent(null)} title={t("aiConsentTitle")}>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-6 shrink-0 text-violet" />
          <p className="text-[15px] leading-relaxed text-fg-2">{t("aiConsentBody")}</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setAskConsent(null)}>
            {t("notNow")}
          </Button>
          <Button
            variant="ai"
            onClick={() => {
              aiConsentPref.set(true);
              const fn = askConsent;
              setAskConsent(null);
              fn?.();
            }}
          >
            {t("aiConsentAllow")}
          </Button>
        </div>
      </Sheet>

      <Sheet open={translating} onClose={() => setTranslating(false)} title={t("aiTranslateTitle")}>
        <div className="grid grid-cols-2 gap-2">
          {LANGS.map((l) => (
            <button
              key={l}
              onClick={() => setTarget(l)}
              className={cx("press h-11 rounded-2xl border text-[14px] font-semibold", target === l ? "border-violet bg-[color-mix(in_srgb,var(--violet)_10%,transparent)] text-violet" : "border-line")}
            >
              {t(l)}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Field label={t("aiTranslatePages")}>
            <TextInput value={range} onChange={(e) => setRange(e.target.value)} placeholder="1-3" inputMode="numeric" />
          </Field>
        </div>
        <Button
          variant="ai"
          className="mt-5 w-full"
          onClick={() => {
            setTranslating(false);
            send("translate", `${t("aiTranslate")} → ${t(target)}${range.trim() ? ` (${range.trim()})` : ""}`, { targetLanguage: t(target), pageRange: range.trim() || undefined });
          }}
        >
          {t("aiTranslate")}
        </Button>
      </Sheet>
      {passwordSheet}
    </div>
  );
}

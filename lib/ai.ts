"use client";

import type { FirebaseApp } from "firebase/app";

import { openPdf, pageTexts } from "./pdf/render";

/**
 * The PDF assistant: the same Firebase function the app calls (pdfAssistant,
 * europe-west1), with an anonymous sign-in per browser. The daily limit is
 * enforced by the function.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCfHgsoAQ0y4uqIM8Dcxy3vncNPIPCEf7A",
  appId: "1:895598853670:web:069d5c309509cd0393f0e7",
  messagingSenderId: "895598853670",
  projectId: "pdf-tools-app-297bf",
  authDomain: "pdf-tools-app-297bf.firebaseapp.com",
  storageBucket: "pdf-tools-app-297bf.firebasestorage.app",
};

export type AiAction = "chat" | "summary" | "keypoints" | "translate";
export type AiFailure = "quota" | "noText" | "scannedTooLarge" | "tooLarge" | "busy" | "offline" | "unavailable" | "refused" | "generic";

export class AiError extends Error {
  constructor(
    public failure: AiFailure,
    public pro = false,
  ) {
    super(failure);
  }
}

export type AiDocument = {
  name: string;
  totalPages: number;
  pages?: string[];
  pdfBase64?: string;
  truncated: boolean;
};

export type AiTurn = { role: "user" | "assistant"; text: string };

// Same thresholds as the app (lib/services/ai_assistant.dart).
const MAX_PDF_BYTES = 7 * 1024 * 1024;
const VISUAL_MAX_PAGES = 30;
const MAX_PDF_PAGES = 100;
const MAX_CHARS = 600_000;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Share of characters that look like a broken text layer (private-use or replacement glyphs). */
function garbledRatio(text: string): number {
  if (!text) return 0;
  let bad = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c === 0xfffd || (c >= 0xe000 && c <= 0xf8ff)) bad++;
  }
  return bad / text.length;
}

/** Short documents and scans go as the PDF itself (the model sees the pages); long ones as text. */
export async function prepareDocument(file: File, password?: string): Promise<AiDocument> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const canSendPdf = !password && bytes.length <= MAX_PDF_BYTES;
  const doc = await openPdf(bytes, password);
  try {
    const total = doc.numPages;
    if (canSendPdf && total <= VISUAL_MAX_PAGES) return { name: file.name, totalPages: total, pdfBase64: toBase64(bytes), truncated: false };

    const pages: string[] = [];
    let chars = 0;
    const texts = await pageTexts(doc, total);
    for (const t of texts) {
      if (chars + t.length > MAX_CHARS) break;
      pages.push(t);
      chars += t.length;
    }
    const text = pages.join("\n");
    const hasText = text.trim().length > 0 && text.length >= 20 * pages.length;
    const readable = hasText && garbledRatio(text) < 0.02;
    if (canSendPdf && total <= MAX_PDF_PAGES && !readable) {
      return { name: file.name, totalPages: total, pdfBase64: toBase64(bytes), truncated: false };
    }
    if (hasText) return { name: file.name, totalPages: total, pages, truncated: pages.length < total };
    throw new AiError(password ? "noText" : "scannedTooLarge");
  } finally {
    void doc?.loadingTask.destroy();
  }
}

let app: Promise<FirebaseApp> | undefined;

async function firebase() {
  app ??= import("firebase/app").then(({ initializeApp, getApps }) => getApps()[0] ?? initializeApp(firebaseConfig));
  return app;
}

async function ensureSignedIn() {
  const a = await firebase();
  const { getAuth, signInAnonymously } = await import("firebase/auth");
  const auth = getAuth(a);
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
}

/** The model ends answers with suggested follow-up questions after this marker. */
const MARKER = "[[FOLLOWUPS]]";

export function splitAnswer(raw: string): { text: string; followUps: string[] } {
  const at = raw.indexOf(MARKER);
  if (at >= 0) {
    const followUps = raw
      .slice(at + MARKER.length)
      .split("|")
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, 3);
    return { text: raw.slice(0, at).trimEnd(), followUps };
  }
  // While streaming, hide a partly received marker at the end.
  for (let n = MARKER.length - 1; n > 0; n--) {
    if (raw.endsWith(MARKER.slice(0, n))) return { text: raw.slice(0, -n).trimEnd(), followUps: [] };
  }
  return { text: raw, followUps: [] };
}

export type AiResult = { userText: string; text: string; remaining?: number; truncated: boolean; stopped?: boolean };

export async function ask(
  doc: AiDocument,
  o: {
    action: AiAction;
    history: AiTurn[];
    uiLanguage: "tr" | "en";
    question?: string;
    targetLanguage?: string;
    pageRange?: string;
    onDelta: (text: string) => void;
    signal?: AbortSignal;
  },
): Promise<AiResult> {
  try {
    await ensureSignedIn();
  } catch {
    throw new AiError("offline");
  }
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const fn = httpsCallable<object, Record<string, unknown>, { t?: string }>(getFunctions(await firebase(), "europe-west1"), "pdfAssistant", {
    timeout: 9 * 60_000,
  });
  const payload = {
    action: o.action,
    fileName: doc.name,
    totalPages: doc.totalPages,
    ...(doc.pages ? { pages: doc.pages } : {}),
    ...(doc.pdfBase64 ? { pdfBase64: doc.pdfBase64 } : {}),
    history: o.history,
    ...(o.question ? { question: o.question } : {}),
    ...(o.targetLanguage ? { targetLanguage: o.targetLanguage } : {}),
    ...(o.pageRange ? { pageRange: o.pageRange } : {}),
    uiLanguage: o.uiLanguage,
  };
  try {
    const { stream, data } = await fn.stream(payload, { signal: o.signal });
    for await (const chunk of stream) {
      if (chunk?.t) o.onDelta(chunk.t);
    }
    const result = await data;
    if (result.refused) throw new AiError("refused");
    return {
      userText: (result.userText as string) ?? o.question ?? "",
      text: (result.text as string) ?? "",
      remaining: typeof result.remaining === "number" ? result.remaining : undefined,
      truncated: result.truncated === true,
      stopped: result.stopped === true,
    };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (o.signal?.aborted) return { userText: o.question ?? "", text: "", truncated: false, stopped: true };
    const err = e as { code?: string; details?: { reason?: string; pro?: boolean } };
    const code = (err.code ?? "").replace(/^functions\//, "");
    const reason = err.details?.reason;
    if (code === "resource-exhausted") throw new AiError("quota", err.details?.pro === true);
    if (code === "unavailable" && reason === "busy") throw new AiError("busy");
    if (code === "unavailable" || code === "deadline-exceeded") throw new AiError("offline");
    if (code === "not-found") throw new AiError("unavailable");
    if (code === "invalid-argument" && reason === "too_large") throw new AiError("tooLarge");
    if (code === "invalid-argument" && reason === "no_text") throw new AiError("noText");
    throw new AiError("generic");
  }
}

/** "(s. 4)", "(p. 2-3)", "(s. 1, s. 3)": the page citations the model writes. */
const PREFIX = "(?:s|ss|sf|sayfa|p|pp|page|pages)\\.?\\s*";
export const CITATION = new RegExp(`\\((${PREFIX})\\d+(?:\\s*(?:[-–,;]|ve|and)\\s*(?:${PREFIX})?\\d+)*\\)`, "gi");

export function citationPages(citation: string): number[] {
  const pages: number[] = [];
  for (const m of citation.matchAll(/(\d+)(?:\s*[-–]\s*(\d+))?/g)) pages.push(Number(m[1]));
  return pages;
}

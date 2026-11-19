"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Read-aloud with the browser's speech engine. Text is spoken in short
 * chunks (long utterances stall in Chrome) and moves on page by page.
 */
export type TtsState = { status: "idle" | "preparing" | "playing" | "paused" | "finished" | "noText" | "failed"; page: number };

function chunks(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) ?? [];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > 220 && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function detectLang(text: string): string {
  return /[çğıöşüİ]/i.test(text) ? "tr-TR" : "en-US";
}

export function useReadAloud(getTexts: () => Promise<string[]>, onPage: (page: number) => void, rate: number) {
  const [state, setState] = useState<TtsState>({ status: "idle", page: 0 });
  const session = useRef(0);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stop = useCallback(() => {
    session.current++;
    if (supported) speechSynthesis.cancel();
    setState((s) => ({ ...s, status: "idle" }));
  }, [supported]);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(
    async (fromPage: number) => {
      if (!supported) {
        setState({ status: "failed", page: fromPage });
        return;
      }
      const id = ++session.current;
      speechSynthesis.cancel();
      setState({ status: "preparing", page: fromPage });
      const texts = await getTexts();
      if (id !== session.current) return;
      if (!texts.some((x) => x.trim())) {
        setState({ status: "noText", page: fromPage });
        return;
      }
      const lang = detectLang(texts.join(" ").slice(0, 4000));
      const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2)));

      const speakPage = (p: number) => {
        if (id !== session.current) return;
        if (p >= texts.length) {
          setState({ status: "finished", page: texts.length - 1 });
          return;
        }
        const parts = chunks(texts[p]);
        if (!parts.length) return speakPage(p + 1);
        onPage(p);
        setState({ status: "playing", page: p });
        let i = 0;
        const next = () => {
          if (id !== session.current) return;
          if (i >= parts.length) return speakPage(p + 1);
          const u = new SpeechSynthesisUtterance(parts[i++]);
          u.lang = lang;
          if (voice) u.voice = voice;
          u.rate = rate;
          u.onend = next;
          u.onerror = (e) => {
            if (e.error !== "interrupted" && e.error !== "canceled") setState({ status: "failed", page: p });
          };
          speechSynthesis.speak(u);
        };
        next();
      };
      speakPage(fromPage);
    },
    [getTexts, onPage, rate, supported],
  );

  const pause = () => {
    speechSynthesis.pause();
    setState((s) => ({ ...s, status: "paused" }));
  };
  const resume = () => {
    speechSynthesis.resume();
    setState((s) => ({ ...s, status: "playing" }));
  };

  return { state, start, stop, pause, resume, supported };
}

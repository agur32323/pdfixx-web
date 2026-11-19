"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import { langPref, usePref } from "../prefs";
import { makeT, type Lang, type T } from "./strings";

export { format, type Lang, type StringKey, type T } from "./strings";

function systemLang(): Lang {
  if (typeof navigator === "undefined") return "tr";
  return (navigator.languages?.[0] ?? navigator.language ?? "tr").toLowerCase().startsWith("tr") ? "tr" : "en";
}

export function useLang(): Lang {
  const p = usePref(langPref);
  const sys = useSyncExternalStore(
    () => () => {},
    systemLang,
    () => "tr" as Lang,
  );
  return p === "system" ? sys : p;
}

const Ctx = createContext<T>(makeT("tr"));

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useLang();
  const t = useMemo(() => makeT(lang), [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <Ctx.Provider value={t}>{children}</Ctx.Provider>;
}

export function useT(): T {
  return useContext(Ctx);
}

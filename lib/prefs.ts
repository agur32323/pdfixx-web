"use client";

import { useSyncExternalStore } from "react";

/**
 * Small preferences kept in localStorage (theme, language, favorites, reading
 * positions…). Each one is a tiny store that React components subscribe to.
 * Files themselves live in IndexedDB (see library.ts).
 */
export type Pref<T> = {
  get(): T;
  set(value: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
  initial: T;
};

const prefix = "pdfixx:";

export function pref<T>(key: string, initial: T): Pref<T> {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | undefined;

  const read = (): T => {
    if (typeof window === "undefined") return initial;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(prefix + key);
    } catch {
      return cache?.value ?? initial;
    }
    if (cache && cache.raw === raw) return cache.value;
    let value = initial;
    if (raw != null) {
      try {
        value = JSON.parse(raw) as T;
      } catch {
        value = initial;
      }
    }
    cache = { raw, value };
    return value;
  };

  const p: Pref<T> = {
    initial,
    get: read,
    set(next) {
      const value = typeof next === "function" ? (next as (prev: T) => T)(read()) : next;
      const raw = JSON.stringify(value);
      try {
        localStorage.setItem(prefix + key, raw);
      } catch {
        // Private mode or full storage: keep the value for this session.
      }
      cache = { raw, value };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === prefix + key) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
  return p;
}

export function usePref<T>(p: Pref<T>): T {
  return useSyncExternalStore(p.subscribe, p.get, () => p.initial);
}

/** True after hydration; use to avoid rendering client-only state on the server. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export type ThemeMode = "system" | "light" | "dark";
export type LangPref = "system" | "tr" | "en";

export const themePref = pref<ThemeMode>("theme", "system");
export const langPref = pref<LangPref>("lang", "system");
export const favoritesPref = pref<string[]>("favorites", []);
export const recentToolsPref = pref<string[]>("recentTools", []);
export const aiConsentPref = pref<boolean>("aiConsent", false);
export const signaturesPref = pref<string[]>("signatures", []);
export const ttsRatePref = pref<number>("ttsRate", 1);
export const nightPref = pref<boolean>("readerNight", false);

/** Last page read per file, and bookmarks. */
export type ReadingState = Record<string, { page: number; total: number; at: number; bookmarks?: number[] }>;
export const readingPref = pref<ReadingState>("reading", {});

/** Cloud conversions used today; the free limit mirrors the app's. */
export const cloudUsagePref = pref<{ day: string; count: number }>("cloudUsage", { day: "", count: 0 });
export const FREE_CLOUD_PER_DAY = 5;
export const FREE_MAX_MB = 100;

export function cloudRemaining(): number {
  const u = cloudUsagePref.get();
  const today = new Date().toISOString().slice(0, 10);
  return FREE_CLOUD_PER_DAY - (u.day === today ? u.count : 0);
}

export function takeCloudUse() {
  const today = new Date().toISOString().slice(0, 10);
  cloudUsagePref.set((u) => ({ day: today, count: (u.day === today ? u.count : 0) + 1 }));
}

export function rememberTool(id: string) {
  recentToolsPref.set((list) => [id, ...list.filter((x) => x !== id)].slice(0, 8));
}

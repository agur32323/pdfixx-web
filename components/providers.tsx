"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";

import { I18nProvider } from "@/lib/i18n";
import { themePref, usePref } from "@/lib/prefs";

/** Keeps <html data-theme> in sync with the setting and the system. */
function ThemeSync() {
  const mode = usePref(themePref);
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && m.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.setAttribute("content", dark ? "#0c0d10" : "#f5f6f8"));
    };
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [mode]);
  return null;
}

function ThemedToaster() {
  const mode = usePref(themePref);
  return (
    <Toaster
      position="top-center"
      theme={mode}
      toastOptions={{ className: "!rounded-2xl !border-line !bg-surface !text-fg !shadow-float !font-sans" }}
      offset={{ top: "calc(12px + env(safe-area-inset-top, 0px))" }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemeSync />
      {children}
      <ThemedToaster />
    </I18nProvider>
  );
}

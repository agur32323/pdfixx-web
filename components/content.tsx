"use client";

import type { ReactNode } from "react";

import { useLang } from "@/lib/i18n";

import { SiteShell } from "./shell";

/** Shows the Turkish or English version of a page, following the site language. */
export function Bilingual({ tr, en }: { tr: ReactNode; en: ReactNode }) {
  return <>{useLang() === "tr" ? tr : en}</>;
}

export function ContentShell({ children }: { children: ReactNode }) {
  return (
    <SiteShell>
      <article className="prose-page mx-auto max-w-3xl px-4 pt-12 md:pt-20">{children}</article>
    </SiteShell>
  );
}

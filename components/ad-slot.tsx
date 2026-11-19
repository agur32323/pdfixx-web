"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useT } from "@/lib/i18n";
import { ADSENSE_CLIENT, ADSENSE_SLOT } from "@/lib/site";

import { cx } from "./ui";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * A labelled ad between sections. Placed only where people pause (below the
 * tools, after a result, in guides), never inside a tool while it's in use.
 */
export function AdSlot({ className }: { className?: string }) {
  const t = useT();
  const path = usePathname();
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!ADSENSE_SLOT || !ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle ??= []).push({});
    } catch {
      // Blocked by an ad blocker.
    }
  }, [path]);

  if (!ADSENSE_SLOT) return null;
  return (
    <div className={cx("mx-auto w-full max-w-5xl", className)}>
      <div className="mb-1.5 text-center text-[11px] font-medium tracking-wide text-fg-3 uppercase">{t("webAdLabel")}</div>
      <div className="min-h-[100px] overflow-hidden rounded-2xl">
        <ins
          key={path}
          ref={ref}
          className="adsbygoogle block"
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}

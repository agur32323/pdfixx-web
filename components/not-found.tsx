"use client";

import Link from "next/link";

import { useT } from "@/lib/i18n";

import { Logo } from "./shell";

export function NotFoundScreen() {
  const t = useT();
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <div className="mb-6 flex justify-center">
          <Logo size={56} />
        </div>
        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">{t("webNotFound")}</h1>
        <p className="mt-2 text-fg-2">{t("webNotFoundBody")}</p>
        <Link href="/" className="press mt-6 inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold text-white">
          {t("backToHome")}
        </Link>
      </div>
    </div>
  );
}

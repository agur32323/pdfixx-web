"use client";

import { ChevronRight, FileText, HardDrive, Languages, LifeBuoy, Palette, ShieldCheck, Smartphone, Trash } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/lib/i18n";
import { library, useLibrary } from "@/lib/library";
import { langPref, themePref, useHydrated, usePref } from "@/lib/prefs";
import { APP_STORE_URL } from "@/lib/site";

import { Button, Confirm, formatBytes, IconTile, Segmented } from "./ui";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 px-1 text-[13px] font-bold tracking-wide text-fg-2 uppercase">{title}</h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ icon, color, title, sub, right, href, external }: { icon: ReactNode; color: string; title: string; sub?: string; right?: ReactNode; href?: string; external?: boolean }) {
  const body = (
    <>
      <IconTile color={color} size={36}>
        {icon}
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{title}</div>
        {sub && <div className="text-[13px] text-fg-2">{sub}</div>}
      </div>
      {right ?? (href && <ChevronRight className="size-5 text-fg-3" />)}
    </>
  );
  const cls = "flex items-center gap-3 px-4 py-3.5";
  if (!href) return <div className={cls}>{body}</div>;
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} press hover:bg-surface-alt`}>
      {body}
    </a>
  ) : (
    <Link href={href} className={`${cls} press hover:bg-surface-alt`}>
      {body}
    </Link>
  );
}

export function SettingsScreen() {
  const t = useT();
  const theme = usePref(themePref);
  const lang = usePref(langPref);
  const files = useLibrary();
  const hydrated = useHydrated();
  const [clearing, setClearing] = useState(false);
  const total = (files ?? []).reduce((n, f) => n + f.size, 0);

  return (
    <div>
      <div className="mx-auto max-w-2xl px-4 pt-10 md:pt-16">
        <h1 className="font-display text-[34px] leading-tight font-extrabold tracking-[-0.035em] md:text-[44px]">{t("settingsTitle")}</h1>
        <p className="mt-1 text-[15px] text-fg-2">{t("webSettingsSub")}</p>

        <Group title={t("appearance")}>
          <div className="px-4 py-3.5">
            <div className="mb-3 flex items-center gap-3">
              <IconTile color="var(--edit)" size={36}>
                <Palette className="size-[18px]" />
              </IconTile>
              <span className="text-[15px] font-semibold">{t("appearance")}</span>
            </div>
            {hydrated && (
              <Segmented
                value={theme}
                onChange={(v) => themePref.set(v)}
                options={[
                  { value: "system", label: t("themeSystem") },
                  { value: "light", label: t("themeLight") },
                  { value: "dark", label: t("themeDark") },
                ]}
              />
            )}
          </div>
          <div className="px-4 py-3.5">
            <div className="mb-3 flex items-center gap-3">
              <IconTile color="var(--from-pdf)" size={36}>
                <Languages className="size-[18px]" />
              </IconTile>
              <span className="text-[15px] font-semibold">{t("language")}</span>
            </div>
            {hydrated && (
              <Segmented
                value={lang}
                onChange={(v) => langPref.set(v)}
                options={[
                  { value: "system", label: t("languageSystem") },
                  { value: "tr", label: "Türkçe" },
                  { value: "en", label: "English" },
                ]}
              />
            )}
          </div>
        </Group>

        <Group title={t("storage")}>
          <Row icon={<HardDrive className="size-[18px]" />} color="var(--optimize)" title={t("storageFiles")} sub={t("webLocalNote")} right={<span className="text-[14px] font-semibold text-fg-2 tabular-nums">{formatBytes(total, t.lang)}</span>} />
          {!!files?.length && (
            <div className="px-4 py-3">
              <Button variant="ghost" size="sm" className="text-danger" icon={<Trash className="size-4" />} onClick={() => setClearing(true)}>
                {t("webClearAll")}
              </Button>
            </div>
          )}
        </Group>

        <Group title={t("privacy")}>
          <div className="flex gap-3 px-4 py-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
            <p className="text-[14px] leading-relaxed text-fg-2">{t("webPrivacyBody")}</p>
          </div>
        </Group>

        <Group title={t("about")}>
          <Row icon={<ShieldCheck className="size-[18px]" />} color="var(--security)" title={t("privacyPolicy")} href="/privacy" />
          <Row icon={<FileText className="size-[18px]" />} color="var(--fg-2)" title={t("webFooterTerms")} href="/terms" />
          <Row icon={<LifeBuoy className="size-[18px]" />} color="var(--to-pdf)" title={t("supportContact")} href="/contact" />
          <Row icon={<Smartphone className="size-[18px]" />} color="var(--brand)" title={t("webGetApp")} sub="iPhone · iPad" href={APP_STORE_URL} external />
        </Group>
        <p className="mt-6 text-center text-[13px] text-fg-3">PDFixx Web · {t("version", { version: "2.0" })}</p>
      </div>
      <Confirm
        open={clearing}
        title={t("webClearAll")}
        body={t("webClearAllBody")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        danger
        onClose={() => setClearing(false)}
        onConfirm={async () => {
          const ids = (files ?? []).map((f) => f.id);
          await library.remove(ids);
          toast(t("deletedCount", { count: ids.length }));
        }}
      />
    </div>
  );
}

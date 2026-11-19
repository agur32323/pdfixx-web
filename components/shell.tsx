"use client";

import { ChevronDown, Folder, Menu, Monitor, Moon, Sparkles, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLang, useT } from "@/lib/i18n";
import { langPref, themePref, useHydrated, usePref } from "@/lib/prefs";
import { APP_STORE_URL } from "@/lib/site";
import { CATEGORIES, categoryColor, toolHref, TOOLS } from "@/lib/tools";

import { cx, IconButton } from "./ui";

export function Logo({ size = 36 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon.png" alt="" width={size} height={size} className="shrink-0 shadow-[0_2px_8px_-2px_rgb(232_57_77/0.5)]" style={{ borderRadius: size * 0.27 }} />
  );
}

export function AppStoreBadge({ compact, className }: { compact?: boolean; className?: string }) {
  const t = useT();
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noreferrer"
      className={cx(
        "press inline-flex items-center gap-2 rounded-xl bg-fg font-semibold text-bg hover:opacity-90",
        compact ? "h-9 px-3 text-[13px]" : "h-11 justify-center px-4 text-sm",
        className,
      )}
    >
      <svg viewBox="0 0 384 512" className="size-4 fill-current" aria-hidden>
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      {compact ? t("webGetAppShort") : t("webGetApp")}
    </a>
  );
}

function ThemeButton() {
  const t = useT();
  const mode = usePref(themePref);
  const hydrated = useHydrated();
  const next = { system: "light", light: "dark", dark: "system" } as const;
  const Icon = !hydrated || mode === "system" ? Monitor : mode === "light" ? Sun : Moon;
  return (
    <IconButton label={t("webTheme")} onClick={() => themePref.set(next[mode])}>
      <Icon className="size-[18px]" />
    </IconButton>
  );
}

function LangButton({ className }: { className?: string }) {
  const lang = useLang();
  return (
    <button
      onClick={() => langPref.set(lang === "tr" ? "en" : "tr")}
      className={cx("press h-9 rounded-full px-3 text-[13px] font-bold tracking-wide text-fg-2 hover:bg-surface-alt hover:text-fg", className)}
      aria-label={lang === "tr" ? "English" : "Türkçe"}
    >
      {lang === "tr" ? "EN" : "TR"}
    </button>
  );
}

/** The "Araçlar" panel: every tool by category, like a mega menu. */
function ToolsPanel({ onPick }: { onPick: () => void }) {
  const t = useT();
  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_260px]">
      {[["organize", "optimize", "image"], ["convertTo", "convertFrom"], ["cad", "edit", "security"]].map((col) => (
        <div key={col.join()} className="grid content-start gap-6">
          {col.map((c) => {
            const cat = CATEGORIES.find((x) => x.id === c)!;
            return (
              <div key={c}>
                <div className="mb-2 px-2 text-[12px] font-bold tracking-[0.06em] text-fg-3 uppercase">{t(cat.title)}</div>
                <div className="grid">
                  {TOOLS.filter((x) => x.category === c).map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <Link
                        key={tool.id}
                        href={toolHref(tool)}
                        onClick={onPick}
                        className="press flex items-center gap-3 rounded-xl px-2 py-1.5 text-[14px] font-medium text-fg hover:bg-surface-alt"
                      >
                        <Icon className="size-[18px] shrink-0" style={{ color: categoryColor(tool.category) }} />
                        {t(tool.title)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <Link href={toolHref("ai")} onClick={onPick} className="press ai-gradient hidden flex-col justify-between rounded-2xl p-5 text-white lg:flex">
        <Sparkles className="size-7" />
        <div>
          <div className="text-[17px] font-bold">{t("toolAi")}</div>
          <p className="mt-1 text-[13px] leading-snug text-white/85">{t("webAiBandTitle")}</p>
        </div>
      </Link>
    </div>
  );
}

export function SiteHeader() {
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close menus on navigation and Escape.
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    setOpen(false);
    setMobile(false);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = mobile ? "hidden" : "";
  }, [mobile]);

  const hover = (v: boolean) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(v), v ? 80 : 160);
  };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={cx("press rounded-full px-3.5 py-2 text-[14px] font-semibold", path === href ? "text-fg" : "text-fg-2 hover:bg-surface-alt hover:text-fg")}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 md:px-8">
        <Link href="/" className="mr-4 flex items-center gap-2.5">
          <Logo size={32} />
          <span className="font-display text-[20px] font-extrabold tracking-[-0.03em]">PDFixx</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" onMouseLeave={() => hover(false)}>
          <button
            onMouseEnter={() => window.matchMedia("(hover: hover)").matches && hover(true)}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cx("press flex items-center gap-1 rounded-full px-3.5 py-2 text-[14px] font-semibold", open ? "bg-surface-alt text-fg" : "text-fg-2 hover:bg-surface-alt hover:text-fg")}
          >
            {t("webNavTools")}
            <ChevronDown className={cx("size-4 transition-transform duration-200 ease-[var(--ease-out)]", open && "rotate-180")} />
          </button>
          <Link
            href={toolHref("ai")}
            className="press flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold text-fg-2 hover:bg-surface-alt hover:text-fg"
          >
            <Sparkles className="size-4 text-violet" />
            {t("toolAi")}
          </Link>
          {navLink("/how-to-merge-pdf", t("webNavGuides"))}

          {open && (
            <div className="absolute inset-x-0 top-full" onMouseEnter={() => hover(true)}>
              <div className="mega-panel mx-auto max-w-7xl px-4 md:px-8">
                <div className="mt-2 rounded-[24px] border border-line bg-surface p-6 shadow-float">
                  <ToolsPanel onPick={() => setOpen(false)} />
                </div>
              </div>
            </div>
          )}
        </nav>

        <span className="flex-1" />
        <Link
          href="/files"
          className={cx(
            "press hidden h-9 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold sm:flex",
            path === "/files" ? "bg-surface-alt text-fg" : "text-fg-2 hover:bg-surface-alt hover:text-fg",
          )}
        >
          <Folder className="size-4" /> {t("navFiles")}
        </Link>
        <LangButton className="hidden sm:block" />
        <span className="hidden sm:block">
          <ThemeButton />
        </span>
        <span className="ml-1 hidden lg:block">
          <AppStoreBadge compact />
        </span>
        <Link href="/files" aria-label={t("navFiles")} className="press grid size-10 place-items-center rounded-full text-fg-2 hover:bg-surface-alt sm:hidden">
          <Folder className="size-5" />
        </Link>
        <IconButton label={t("webNavMenu")} className="md:hidden" onClick={() => setMobile(true)}>
          <Menu className="size-5 text-fg" />
        </IconButton>
      </div>

      {mobile &&
        createPortal(
        <div className="fixed inset-0 z-50 flex flex-col bg-bg md:hidden">
          <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-4 pt-[env(safe-area-inset-top,0px)]">
            <Logo size={32} />
            <span className="font-display flex-1 text-[20px] font-extrabold tracking-[-0.03em]">PDFixx</span>
            <LangButton />
            <ThemeButton />
            <IconButton label={t("close")} onClick={() => setMobile(false)}>
              <X className="size-5 text-fg" />
            </IconButton>
          </div>
          <div className="scroll-area flex-1 px-4 pt-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
            <div className="grid grid-cols-2 gap-2">
              <Link href={toolHref("ai")} className="press ai-gradient flex items-center gap-2 rounded-2xl p-3 text-[14px] font-semibold text-white">
                <Sparkles className="size-5" /> {t("toolAi")}
              </Link>
              <Link href="/files" className="press flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-[14px] font-semibold">
                <Folder className="size-5 text-fg-2" /> {t("navFiles")}
              </Link>
            </div>
            <div className="mt-6">
              <ToolsPanel onPick={() => setMobile(false)} />
            </div>
            <div className="mt-6 grid gap-1 border-t border-line pt-4 text-[15px] font-medium">
              <Link href="/how-to-merge-pdf" className="py-2">{t("webNavGuides")}</Link>
              <Link href="/settings" className="py-2">{t("navSettings")}</Link>
              <Link href="/about" className="py-2">{t("webFooterAbout")}</Link>
            </div>
            <AppStoreBadge className="mt-6 w-full" />
          </div>
        </div>,
          document.body,
        )}
    </header>
  );
}

export function SiteFooter() {
  const t = useT();
  const col = (title: string, links: { href: string; label: string; external?: boolean }[]) => (
    <div>
      <div className="mb-3 text-[13px] font-bold text-fg">{title}</div>
      <ul className="grid gap-2">
        {links.map((l) => (
          <li key={l.href}>
            {l.external ? (
              <a href={l.href} target="_blank" rel="noreferrer" className="text-[14px] text-fg-2 hover:text-fg">
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="text-[14px] text-fg-2 hover:text-fg">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
  const tools = (cats: string[]) => TOOLS.filter((x) => cats.includes(x.category)).map((x) => ({ href: toolHref(x), label: t(x.title) }));
  return (
    <footer className="mt-24 border-t border-line bg-surface/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.3fr_repeat(4,1fr)] md:px-8">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-display text-[20px] font-extrabold tracking-[-0.03em]">PDFixx</span>
          </Link>
          <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-fg-2">{t("webFooterTagline")}</p>
          <AppStoreBadge className="mt-5" />
        </div>
        {col(t("webOrganizeTools"), tools(["organize", "optimize", "image"]))}
        {col(t("webConvertTools"), tools(["convertTo", "convertFrom", "cad"]))}
        {col(t("webEditTools"), [...tools(["edit", "security"]), { href: toolHref("ai"), label: t("toolAi") }])}
        <div className="grid content-start gap-10">
          {col(t("webFooterCompany"), [
            { href: "/about", label: t("webFooterAbout") },
            { href: "/contact", label: t("webFooterContact") },
            { href: "/how-to-merge-pdf", label: t("webGuideMerge") },
            { href: "/how-to-split-pdf", label: t("webGuideSplit") },
            { href: "/how-to-convert-word-to-pdf", label: t("webGuideWord") },
          ])}
          {col(t("webFooterLegal"), [
            { href: "/privacy", label: t("privacyPolicy") },
            { href: "/terms", label: t("webFooterTerms") },
          ])}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-fg-3 md:px-8">
          <span>© {new Date().getFullYear()} PDFixx</span>
          <span className="flex items-center gap-1">
            <LangButton />
            <ThemeButton />
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Website frame: header, page, footer. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}


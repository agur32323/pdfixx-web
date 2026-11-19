"use client";

import { ArrowRight, BookOpen, ChevronDown, Cloud, Gift, MonitorSmartphone, Search, ShieldCheck, Sparkles, Star, Upload, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useLang, useT } from "@/lib/i18n";
import { kindOf, library, useLibrary } from "@/lib/library";
import { favoritesPref, readingPref, recentToolsPref, usePref } from "@/lib/prefs";
import { CATEGORIES, categoryColor, type ToolDef, toolById, toolHref, TOOLS } from "@/lib/tools";

import { AdSlot } from "./ad-slot";
import { AppStoreBadge } from "./shell";
import { FileThumb } from "./thumbs";
import { handOff } from "./tool-kit";
import { ActionList, cx, formatBytes, IconTile, Sheet } from "./ui";

export function ToolCard({ tool, onMenu }: { tool: ToolDef; onMenu?: (t: ToolDef) => void }) {
  const t = useT();
  const Icon = tool.icon;
  const color = categoryColor(tool.category);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);
  return (
    <Link
      href={toolHref(tool)}
      onContextMenu={(e) => {
        if (!onMenu) return;
        e.preventDefault();
        onMenu(tool);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch" || !onMenu) return;
        longPressed.current = false;
        timer.current = setTimeout(() => {
          longPressed.current = true;
          onMenu(tool);
        }, 500);
      }}
      onPointerUp={() => clearTimeout(timer.current)}
      onPointerLeave={() => clearTimeout(timer.current)}
      onClick={(e) => longPressed.current && e.preventDefault()}
      className="press lift group relative flex gap-4 rounded-[20px] border border-line bg-surface p-4 sm:flex-col sm:gap-0 sm:p-5"
      style={{ ["--tool" as string]: color }}
    >
      <IconTile color={color} size={44}>
        <Icon className="size-[22px]" strokeWidth={2.1} />
      </IconTile>
      {tool.cloud && <Cloud className="absolute top-4 right-4 size-4 text-fg-3 sm:top-5 sm:right-5" aria-label={t("cloud")} />}
      <div className="min-w-0 sm:mt-5">
        <div className="flex items-center gap-1.5 text-[15px] leading-tight font-bold tracking-[-0.01em]">
          {t(tool.title)}
          <ArrowRight className="hidden size-4 -translate-x-1 text-[color:var(--tool)] opacity-0 transition-[opacity,transform] duration-200 ease-[var(--ease-out)] group-hover:translate-x-0 group-hover:opacity-100 sm:block" />
        </div>
        <div className="mt-1 text-[13px] leading-snug text-fg-2 sm:line-clamp-2">{t(tool.sub)}</div>
      </div>
    </Link>
  );
}

function ToolGrid({ tools, onMenu }: { tools: ToolDef[]; onMenu?: (t: ToolDef) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} onMenu={onMenu} />
      ))}
    </div>
  );
}

function Hero({ onFiles }: { onFiles: (f: File[]) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const popular = ["merge", "compress", "image_compress", "imagepdf", "sign", "split"].map((id) => toolById(id)!);
  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow pointer-events-none absolute inset-0" />
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-5xl px-4 pt-14 pb-16 text-center md:pt-24 md:pb-24">
        <span className="enter inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-[13px] font-medium text-fg-2 shadow-card backdrop-blur">
          <ShieldCheck className="size-4 text-success" />
          {t("webHeroEyebrow")}
        </span>
        <h1 className="font-display mt-6 text-[34px] leading-[1.06] font-extrabold tracking-[-0.04em] text-balance min-[400px]:text-[38px] sm:text-[56px] md:text-[72px]">
          {t("webHeroTitle1")}
          <br />
          <span className="bg-[linear-gradient(100deg,var(--brand),#c03fb0_55%,var(--violet))] bg-clip-text text-transparent">{t("webHeroTitle2")}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-fg-2 md:text-[19px]">{t("webHeroSub")}</p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOver(false);
            onFiles(Array.from(e.dataTransfer.files));
          }}
          className={cx(
            "mx-auto mt-10 max-w-3xl rounded-[28px] border bg-surface/90 p-2 shadow-float backdrop-blur transition-colors duration-150",
            over ? "border-brand" : "border-line",
          )}
        >
          <div
            className={cx(
              "flex flex-col items-center gap-5 rounded-[22px] border-2 border-dashed px-6 py-10 sm:flex-row sm:text-left md:px-10",
              over ? "border-brand bg-[color-mix(in_srgb,var(--brand)_5%,transparent)]" : "border-line",
            )}
          >
            <span className="brand-gradient grid size-16 shrink-0 place-items-center rounded-2xl text-white shadow-[0_10px_24px_-10px_rgb(200_30_58/0.8)]">
              <Upload className="size-7" />
            </span>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="text-[20px] font-bold tracking-[-0.01em]">{t("webHeroDrop")}</div>
              <div className="mt-1 text-[14px] text-fg-2">{t("webHeroDropSub")}</div>
            </div>
            <button onClick={() => input.current?.click()} className="press h-12 shrink-0 rounded-2xl bg-brand px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(232_57_77/0.7)] hover:bg-brand-deep">
              {t("webHeroDropButton")}
            </button>
            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.dwf"
              multiple
              hidden
              onChange={(e) => {
                const f = Array.from(e.target.files ?? []);
                e.target.value = "";
                onFiles(f);
              }}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[13px]">
          <span className="text-fg-3">{t("webPopular")}</span>
          {popular.map((tool) => (
            <Link key={tool.id} href={toolHref(tool)} className="press rounded-full border border-line bg-surface px-3 py-1.5 font-semibold text-fg-2 hover:border-fg-3 hover:text-fg">
              {t(tool.title)}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function YourFiles() {
  const t = useT();
  const files = useLibrary();
  const reading = usePref(readingPref);
  const last = useMemo(() => {
    if (!files) return null;
    const e = Object.entries(reading)
      .filter(([id, r]) => r.page > 1 && r.page < r.total && files.some((f) => f.id === id))
      .sort((a, b) => b[1].at - a[1].at)[0];
    return e ? { file: files.find((f) => f.id === e[0])!, ...e[1] } : null;
  }, [files, reading]);
  if (!files?.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">{t("recentFiles")}</h2>
        <Link href="/files" className="text-[14px] font-semibold text-brand hover:underline">
          {t("seeAll")}
        </Link>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {last && (
          <Link href={`/view?id=${last.file.id}`} className="press lift flex w-[300px] shrink-0 snap-start items-center gap-4 rounded-[20px] border border-line bg-surface p-3">
            <FileThumb file={last.file} className="h-[92px] w-[68px] shrink-0 rounded-lg border border-line" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-brand">{t("readerContinue")}</div>
              <div className="truncate text-[15px] font-bold">{last.file.name.replace(/\.pdf$/i, "")}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(last.page / last.total) * 100}%` }} />
              </div>
              <div className="mt-1 text-[12px] text-fg-2">{t("readerProgress", { page: last.page, total: last.total })}</div>
            </div>
          </Link>
        )}
        {files.slice(0, 8).map((f) => (
          <Link key={f.id} href={kindOf(f) === "pdf" ? `/view?id=${f.id}` : "/files"} className="press group w-[124px] shrink-0 snap-start">
            <FileThumb file={f} className="aspect-[3/4] rounded-2xl border border-line transition-shadow group-hover:shadow-card" />
            <div className="mt-2 truncate text-[13px] font-medium">{f.name}</div>
            <div className="text-[12px] text-fg-3">{formatBytes(f.size, t.lang)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AiBand() {
  const t = useT();
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8">
      <div className="relative overflow-hidden rounded-[32px] bg-[#120d24] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_0%_0%,rgb(109_59_245/0.55),transparent_60%),radial-gradient(50%_70%_at_100%_100%,rgb(232_57_77/0.45),transparent_60%)]" />
        <div className="relative grid gap-10 p-8 md:grid-cols-2 md:items-center md:p-14">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold tracking-wide uppercase">
              <Sparkles className="size-3.5" /> {t("webAiBandEyebrow")}
            </span>
            <h2 className="font-display mt-4 text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] md:text-[44px]">{t("webAiBandTitle")}</h2>
            <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-white/75">{t("webAiBandBody")}</p>
            <Link href={toolHref("ai")} className="press mt-7 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-bold text-[#2a1a5e] hover:bg-white/90">
              {t("webAiBandCta")} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-3">
            <div className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-violet px-4 py-3 text-[15px]">{t("webAiBandQ")}</div>
            <div className="max-w-[92%] rounded-3xl rounded-tl-lg border border-white/10 bg-white/[0.08] p-4 text-[15px] leading-relaxed backdrop-blur">
              {t("webAiBandA")}{" "}
              <span className="inline-flex h-6 items-center rounded-full bg-white/15 px-2 align-middle text-[12px] font-bold">{t("aiPageLink", { page: 2 })}</span>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3 text-[12px]">
                <span className="rounded-full border border-white/15 px-2.5 py-1 text-white/80">{t("aiSummary")}</span>
                <span className="rounded-full border border-white/15 px-2.5 py-1 text-white/80">{t("aiKeypoints")}</span>
                <span className="rounded-full border border-white/15 px-2.5 py-1 text-white/80">{t("aiTranslate")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const t = useT();
  const items = [
    { icon: ShieldCheck, color: "var(--success)", title: t("webFeature1Title"), body: t("webFeature1Body") },
    { icon: Zap, color: "var(--to-pdf)", title: t("webFeature2Title"), body: t("webFeature2Body") },
    { icon: MonitorSmartphone, color: "var(--from-pdf)", title: t("webFeature3Title"), body: t("webFeature3Body") },
    { icon: Gift, color: "var(--brand)", title: t("webFeature4Title"), body: t("webFeature4Body") },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8">
      <h2 className="font-display text-center text-[30px] font-extrabold tracking-[-0.03em] md:text-[40px]">{t("webFeaturesTitle")}</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.title} className="rounded-[24px] border border-line bg-surface p-6">
            <IconTile color={it.color} size={44}>
              <it.icon className="size-[22px]" />
            </IconTile>
            <div className="mt-5 text-[17px] font-bold tracking-[-0.01em]">{it.title}</div>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Steps() {
  const t = useT();
  const steps = [
    [t("webStep1"), t("webStep1Sub")],
    [t("webStep2"), t("webStep2Sub")],
    [t("webStep3"), t("webStep3Sub")],
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8">
      <h2 className="font-display text-center text-[30px] font-extrabold tracking-[-0.03em] md:text-[40px]">{t("webStepsTitle")}</h2>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="relative rounded-[24px] border border-line bg-surface p-6">
            <span className="font-display text-[44px] leading-none font-extrabold tracking-[-0.04em] text-[color-mix(in_srgb,var(--brand)_22%,transparent)]">0{i + 1}</span>
            <div className="mt-4 text-[17px] font-bold">{title}</div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AppBand() {
  const t = useT();
  const lang = useLang();
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8">
      <div className="relative grid overflow-hidden rounded-[32px] border border-line bg-surface md:grid-cols-[1.1fr_1fr]">
        <div className="p-8 md:p-14">
          <h2 className="font-display text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em] md:text-[40px]">{t("webAppBandTitle")}</h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-fg-2">{t("webAppBandBody")}</p>
          <div className="mt-6 flex items-center gap-1 text-[color:var(--to-pdf)]">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="size-4 fill-current" />
            ))}
          </div>
          <AppStoreBadge className="mt-6" />
        </div>
        <div className="relative h-[360px] overflow-hidden md:h-auto md:min-h-[440px]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--brand),var(--violet))] opacity-[0.14]" />
          <div className="absolute inset-x-0 top-10 flex justify-center gap-4 md:top-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/app/home-${lang}.png`} alt="PDFixx iOS" className="w-[42%] max-w-[230px] rounded-[34px] shadow-float" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/app/assistant-${lang}.png`} alt="" className="mt-10 w-[42%] max-w-[230px] rounded-[34px] shadow-float" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const t = useT();
  const items = ([1, 2, 3, 4, 5] as const).map((i) => [t(`webFaq${i}Q`), t(`webFaq${i}A`)]);
  return (
    <section className="mx-auto max-w-3xl px-4">
      <h2 className="font-display text-center text-[30px] font-extrabold tracking-[-0.03em] md:text-[40px]">{t("webFaqTitle")}</h2>
      <div className="mt-10 divide-y divide-line rounded-[24px] border border-line bg-surface">
        {items.map(([q, a]) => (
          <details key={q} className="group px-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-[16px] font-semibold">
              <span className="flex-1">{q}</span>
              <ChevronDown className="size-5 shrink-0 text-fg-3 transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-180" />
            </summary>
            <p className="-mt-1 pb-5 text-[15px] leading-relaxed text-fg-2">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<ToolDef | null>(null);
  const [dragging, setDragging] = useState(false);
  const favorites = usePref(favoritesPref);
  const recent = usePref(recentToolsPref);

  const locale = t.lang === "tr" ? "tr-TR" : "en-US";
  const q = query.trim().toLocaleLowerCase(locale);
  const found = q ? TOOLS.filter((x) => `${t(x.title)} ${t(x.sub)} ${x.slug.replace(/-/g, " ")}`.toLocaleLowerCase(locale).includes(q)) : [];
  const favTools = favorites.map(toolById).filter(Boolean) as ToolDef[];
  const recentTools = recent
    .map(toolById)
    .filter((x): x is ToolDef => !!x && !favorites.includes(x.id))
    .slice(0, 4);

  const openFiles = async (files: File[]) => {
    const pdfs = files.filter((f) => kindOf(f) === "pdf");
    const images = files.filter((f) => kindOf(f) === "image");
    if (pdfs.length === 1 && !images.length) {
      const saved = await library.add(pdfs[0], pdfs[0].name);
      router.push(`/view?id=${saved.id}`);
    } else if (pdfs.length > 1) {
      handOff(pdfs);
      router.push(toolHref("merge"));
    } else if (images.length) {
      handOff(images);
      router.push(toolHref("imagepdf"));
    } else if (files.length) {
      const ext = files[0].name.split(".").pop()?.toLowerCase() ?? "";
      handOff([files[0]]);
      const tool = ["dwg", "dxf", "dwf"].includes(ext)
        ? "dwg_pdf"
        : ["xls", "xlsx", "ods"].includes(ext)
          ? "excel_pdf"
          : ["ppt", "pptx", "odp"].includes(ext)
            ? "ppt_pdf"
            : "word_pdf";
      router.push(toolHref(tool));
    }
  };

  const toggleFavorite = (tool: ToolDef) => {
    const on = favorites.includes(tool.id);
    favoritesPref.set((list) => (on ? list.filter((x) => x !== tool.id) : [...list, tool.id]));
    toast.success(on ? t("removedFromFavorites") : t("addedToFavorites"));
  };

  return (
    <div
      onDragEnter={(e) => e.dataTransfer.types.includes("Files") && setDragging(true)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void openFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <Hero onFiles={(f) => void openFiles(f)} />

      <div className="grid gap-20 md:gap-28">
        <YourFiles />

        <section id="tools" className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-[30px] font-extrabold tracking-[-0.03em] md:text-[40px]">{t("webAllTools")}</h2>
              <p className="mt-1 text-[15px] text-fg-2">{t("webAllToolsSub", { count: TOOLS.length })}</p>
            </div>
            <label className="flex h-12 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-[color-mix(in_srgb,var(--brand)_12%,transparent)] md:w-80">
              <Search className="size-[18px] shrink-0 text-fg-3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchTools")}
                enterKeyHint="search"
                className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-3"
              />
            </label>
          </div>

          {q ? (
            <div className="mt-8">{found.length ? <ToolGrid tools={found} onMenu={setMenu} /> : <p className="py-16 text-center text-fg-2">{t("noToolsFound")}</p>}</div>
          ) : (
            <div className="mt-10 grid gap-12">
              {favTools.length > 0 && (
                <div>
                  <h3 className="mb-4 text-[13px] font-bold tracking-[0.06em] text-fg-3 uppercase">{t("favorites")}</h3>
                  <ToolGrid tools={favTools} onMenu={setMenu} />
                </div>
              )}
              {recentTools.length > 0 && (
                <div>
                  <h3 className="mb-4 text-[13px] font-bold tracking-[0.06em] text-fg-3 uppercase">{t("recentTools")}</h3>
                  <ToolGrid tools={recentTools} onMenu={setMenu} />
                </div>
              )}
              {CATEGORIES.map((c) => (
                <div key={c.id}>
                  <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold tracking-[0.06em] text-fg-3 uppercase">
                    <span className="size-2 rounded-full" style={{ background: c.color }} />
                    {t(c.title)}
                  </h3>
                  <ToolGrid tools={TOOLS.filter((x) => x.category === c.id)} onMenu={setMenu} />
                </div>
              ))}
            </div>
          )}
        </section>

        <AdSlot className="px-4" />
        <AiBand />
        <Features />
        <Steps />
        <AppBand />
        <Faq />
      </div>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu ? t(menu.title) : undefined}>
        {menu && (
          <ActionList
            items={[
              {
                icon: <Star className={cx("size-5", favorites.includes(menu.id) && "fill-current text-[color:var(--to-pdf)]")} />,
                label: favorites.includes(menu.id) ? t("removeFavorite") : t("addFavorite"),
                onClick: () => {
                  toggleFavorite(menu);
                  setMenu(null);
                },
              },
              {
                icon: <BookOpen className="size-5" />,
                label: t("open"),
                onClick: () => {
                  setMenu(null);
                  router.push(toolHref(menu));
                },
              },
            ]}
          />
        )}
      </Sheet>

      {dragging && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--brand)_14%,var(--overlay))] p-6 backdrop-blur-sm"
          onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void openFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="pointer-events-none rounded-[28px] border-2 border-dashed border-white/70 px-12 py-10 text-center text-2xl font-bold text-white">{t("webDropAnywhere")}</div>
        </div>
      )}
    </div>
  );
}

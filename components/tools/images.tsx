"use client";

import { Camera, ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";

import { useT } from "@/lib/i18n";
import { imagesToPdf, type ImagePdfOptions } from "@/lib/pdf/engine";
import type { ToolDef } from "@/lib/tools";

import { Sortable } from "../sortable";
import { AddMore, type InputFile, OptionCard, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { Button, cx, IconButton, Segmented, useObjectUrl } from "../ui";

function ImageThumb({ input }: { input: InputFile }) {
  const url = useObjectUrl(input.file);
  return (
    <div className="aspect-[3/4] overflow-hidden rounded-xl bg-surface-alt">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="size-full object-cover" draggable={false} />}
    </div>
  );
}

/** "Belge Tara" (camera first) and "Görselden PDF". */
export default function ImagesTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const scan = tool.id === "scan";
  const { inputs, setInputs, add } = useInputs({ multiple: true });
  const job = useJob(tool);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [opts, setOpts] = useState<ImagePdfOptions>({ pageSize: "a4", orientation: "auto", margin: scan ? "none" : "small" });
  const set = <K extends keyof ImagePdfOptions>(k: K, v: ImagePdfOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const run = () =>
    job.run(async (c) => {
      c.stage(t("stageCreatingPdf"));
      const bytes = await imagesToPdf(
        inputs.map((i) => i.file),
        opts,
        (done) => c.progress(done / inputs.length),
      );
      const date = new Date().toLocaleDateString(t.lang === "tr" ? "tr-TR" : "en-CA").replace(/\//g, "-");
      return { outputs: [{ blob: pdfBlob(bytes), name: `${scan ? t("scanOutputName") : t("imagesOutputName")} ${date}.pdf` }] };
    });

  const pickers = (
    <>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (f.length) void add(f);
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (f.length) void add(f);
        }}
      />
    </>
  );

  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => setInputs([])}
      action={inputs.length ? { label: t("createPdf"), onClick: run, hint: t("imagesCount", { count: inputs.length }) } : undefined}
    >
      {pickers}
      {inputs.length === 0 ? (
        <div
          className="grid place-items-center rounded-[28px] border-2 border-dashed border-line bg-surface px-6 py-14 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = Array.from(e.dataTransfer.files).filter((x) => x.type.startsWith("image/"));
            if (f.length) void add(f);
          }}
        >
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--to-pdf)_14%,transparent)] text-[color:var(--to-pdf)]">
            {scan ? <Camera className="size-6" /> : <ImagePlus className="size-6" />}
          </span>
          <div className="text-[17px] font-bold">{t("imagesEmptyTitle")}</div>
          <p className="mt-1 mb-5 max-w-sm text-[14px] text-fg-2">{t("imagesEmptyBody")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" variant={scan ? "primary" : "secondary"} icon={<Camera className="size-5" />} onClick={() => camera.current?.click()}>
              {t("sourceCamera")}
            </Button>
            <Button size="lg" variant={scan ? "secondary" : "primary"} icon={<ImagePlus className="size-5" />} onClick={() => gallery.current?.click()}>
              {t("sourceGallery")}
            </Button>
          </div>
          <p className="mt-4 text-[13px] text-fg-3">{t("webCameraHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <Sortable items={inputs} getId={(i) => i.key} onReorder={setInputs} grid className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {(input, i, handle, dragging) => (
              <div {...handle.attributes} {...handle.listeners} className={cx("relative cursor-grab touch-manipulation rounded-2xl border border-line bg-surface p-1.5", dragging && "shadow-float")}>
                <ImageThumb input={input} />
                <span className="absolute bottom-3 left-3 grid size-6 place-items-center rounded-full bg-black/60 text-[12px] font-bold text-white">{i + 1}</span>
                <IconButton
                  label={t("remove")}
                  className="absolute top-2.5 right-2.5 size-7 bg-black/55 text-white hover:bg-black/70 hover:text-white"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setInputs((l) => l.filter((x) => x.key !== input.key))}
                >
                  <X className="size-4" />
                </IconButton>
              </div>
            )}
          </Sortable>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Camera className="size-5" />} onClick={() => camera.current?.click()}>
              {t("sourceCamera")}
            </Button>
            <AddMore accept="image/*" onFiles={add} />
          </div>
          <p className="text-[13px] text-fg-2">{t("mergeReorderHint")}</p>
          <OptionCard title={t("pageSize")}>
            <Segmented
              value={opts.pageSize}
              onChange={(v) => set("pageSize", v)}
              options={[
                { value: "a4", label: "A4" },
                { value: "letter", label: "Letter" },
                { value: "fit", label: t("pageSizeFit") },
              ]}
            />
            {opts.pageSize !== "fit" && (
              <>
                <div className="mt-4 mb-2 text-[13px] font-semibold text-fg-2">{t("orientation")}</div>
                <Segmented
                  value={opts.orientation}
                  onChange={(v) => set("orientation", v)}
                  options={[
                    { value: "auto", label: t("orientationAuto") },
                    { value: "portrait", label: t("orientationPortrait") },
                    { value: "landscape", label: t("orientationLandscape") },
                  ]}
                />
              </>
            )}
            <div className="mt-4 mb-2 text-[13px] font-semibold text-fg-2">{t("margin")}</div>
            <Segmented
              value={opts.margin}
              onChange={(v) => set("margin", v)}
              options={[
                { value: "none", label: t("marginNone") },
                { value: "small", label: t("marginSmall") },
                { value: "large", label: t("marginLarge") },
              ]}
            />
          </OptionCard>
        </div>
      )}
    </ToolScaffold>
  );
}

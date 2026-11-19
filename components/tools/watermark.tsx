"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { useT } from "@/lib/i18n";
import { bytesOf, watermark, type WatermarkOptions } from "@/lib/pdf/engine";
import type { ToolDef } from "@/lib/tools";

import { PageThumb, usePdfDoc } from "../thumbs";
import { DropZone, InputRow, JobFailure, OptionCard, outName, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { cx, Field, Segmented, Slider, TextInput } from "../ui";

const COLORS = ["#E8394D", "#101828", "#667085", "#2E90FA", "#12B76A"];
const SIZE = { small: 0.06, medium: 0.1, large: 0.15 };

export default function WatermarkTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const { doc } = usePdfDoc(input?.file, input?.password);
  const job = useJob(tool);
  const [o, setO] = useState<WatermarkOptions>({ text: t("watermarkDefault"), size: "medium", opacity: 0.25, color: COLORS[0], layout: "diagonal" });
  const set = <K extends keyof WatermarkOptions>(k: K, v: WatermarkOptions[K]) => setO((x) => ({ ...x, [k]: v }));

  const run = () =>
    job.run(async (c) => {
      if (!o.text.trim()) throw new JobFailure(t("watermarkEmpty"));
      c.stage(t("stageWatermark"));
      const out = await watermark(await bytesOf(input.file), { ...o, text: o.text.trim() }, input.password);
      return { outputs: [{ blob: pdfBlob(out), name: outName(input.file.name, "_watermarked") }] };
    });

  const fontCqw = SIZE[o.size] * 100 * (o.layout === "tiled" ? 0.55 : 1);
  return (
    <ToolScaffold tool={tool} job={job} onNewFile={() => setInputs([])} action={input ? { label: t("watermarkAction"), onClick: run, disabled: !o.text.trim() } : undefined}>
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
          <div className="grid gap-4">
            <InputRow input={input} onChange={() => setInputs([])} />
            <OptionCard>
              <Field label={t("watermarkText")} error={o.text.trim() ? null : t("watermarkEmpty")}>
                <TextInput value={o.text} onChange={(e) => set("text", e.target.value)} maxLength={60} />
              </Field>
              <div className="mt-4 mb-2 text-[13px] font-semibold text-fg-2">{t("layout")}</div>
              <Segmented
                value={o.layout}
                onChange={(v) => set("layout", v)}
                options={[
                  { value: "diagonal", label: t("layoutDiagonal") },
                  { value: "horizontal", label: t("layoutHorizontal") },
                  { value: "tiled", label: t("layoutTiled") },
                ]}
              />
              <div className="mt-4 mb-2 text-[13px] font-semibold text-fg-2">{t("size")}</div>
              <Segmented
                value={o.size}
                onChange={(v) => set("size", v)}
                options={[
                  { value: "small", label: t("sizeSmall") },
                  { value: "medium", label: t("sizeMedium") },
                  { value: "large", label: t("sizeLarge") },
                ]}
              />
              <div className="mt-4">
                <Slider label={t("opacity")} min={0.05} max={0.8} step={0.05} value={o.opacity} onChange={(v) => set("opacity", v)} format={(v) => `%${Math.round(v * 100)}`} />
              </div>
              <div className="mt-4 mb-2 text-[13px] font-semibold text-fg-2">{t("color")}</div>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    aria-label={c}
                    onClick={() => set("color", c)}
                    className={cx("press grid size-9 place-items-center rounded-full", o.color === c && "ring-2 ring-offset-2 ring-offset-surface")}
                    style={{ background: c, ["--tw-ring-color" as string]: c }}
                  >
                    {o.color === c && <Check className="size-4 text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </OptionCard>
          </div>
          {doc && (
            <div className="card sticky top-4 p-3">
              <div className="mb-2 text-[13px] font-semibold text-fg-2">{t("preview")}</div>
              <div className="relative overflow-hidden [container-type:inline-size]">
                <PageThumb doc={doc} index={0} width={280} />
                <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
                  {o.layout === "tiled" ? (
                    <div className="grid -rotate-45 grid-cols-3 gap-x-[8cqw] gap-y-[14cqw]">
                      {Array.from({ length: 21 }, (_, i) => (
                        <span key={i} className="font-bold whitespace-nowrap" style={{ color: o.color, opacity: o.opacity, fontSize: `${fontCqw}cqw` }}>
                          {o.text}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span
                      className={cx("font-bold whitespace-nowrap", o.layout === "diagonal" && "-rotate-45")}
                      style={{ color: o.color, opacity: o.opacity, fontSize: `${fontCqw}cqw` }}
                    >
                      {o.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

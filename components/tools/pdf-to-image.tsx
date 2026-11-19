"use client";

import { useState } from "react";

import { useT } from "@/lib/i18n";
import { parseRanges } from "@/lib/pdf/engine";
import { canvasToBlob, openPdf, renderPage } from "@/lib/pdf/render";
import type { ToolDef } from "@/lib/tools";

import { DropZone, InputRow, OptionCard, outName, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { Field, Segmented, TextInput } from "../ui";

const DPI = { low: 96, medium: 150, high: 300 } as const;

export default function PdfToImageTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const total = input?.pages ?? 0;
  const job = useJob(tool);
  const [format, setFormat] = useState<"jpg" | "png">("jpg");
  const [res, setRes] = useState<keyof typeof DPI>("medium");
  const [all, setAll] = useState(true);
  const [range, setRange] = useState("1");
  const pages = all ? Array.from({ length: total }, (_, i) => i) : parseRanges(range, total)?.flat() ?? null;

  const run = () =>
    job.run(async (c) => {
      c.stage(t("stageRenderingImages"));
      const doc = await openPdf(input.file, input.password);
      const outputs = [];
      try {
        for (let n = 0; n < pages!.length; n++) {
          const page = await doc.getPage(pages![n] + 1);
          const vp = page.getViewport({ scale: 1 });
          const canvas = await renderPage(page, (vp.width * DPI[res]) / 72, { dpr: 1 });
          const blob = await canvasToBlob(canvas, format === "png" ? "image/png" : "image/jpeg", 0.9);
          canvas.width = canvas.height = 0;
          page.cleanup();
          outputs.push({ blob, name: outName(input.file.name, `_${pages![n] + 1}`, format) });
          c.progress((n + 1) / pages!.length);
          if (c.signal.aborted) break;
        }
      } finally {
        void doc.loadingTask.destroy();
      }
      return { outputs };
    });

  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => setInputs([])}
      action={input ? { label: t("convertAction"), onClick: run, disabled: !pages?.length, hint: pages ? t("imagesCount", { count: pages.length }) : undefined } : undefined}
    >
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          <OptionCard title={t("imageFormat")}>
            <Segmented
              value={format}
              onChange={setFormat}
              options={[
                { value: "jpg", label: "JPG" },
                { value: "png", label: "PNG" },
              ]}
            />
            <div className="mt-4 mb-2 text-[13px] font-semibold text-fg-2">{t("resolution")}</div>
            <Segmented
              value={res}
              onChange={setRes}
              options={[
                { value: "low", label: `${t("resolutionLow")} · 96` },
                { value: "medium", label: `${t("resolutionMedium")} · 150` },
                { value: "high", label: `${t("resolutionHigh")} · 300` },
              ]}
            />
          </OptionCard>
          <OptionCard title={t("pagesLabel")}>
            <Segmented
              value={all ? "all" : "range"}
              onChange={(v) => setAll(v === "all")}
              options={[
                { value: "all", label: t("pagesAll") },
                { value: "range", label: t("pagesRange") },
              ]}
            />
            {!all && (
              <div className="mt-4">
                <Field error={pages ? null : t("splitRangesInvalid", { max: total })} hint={t("viewerPageRange", { total })}>
                  <TextInput value={range} onChange={(e) => setRange(e.target.value)} inputMode="numeric" placeholder="1-3, 5" />
                </Field>
              </div>
            )}
          </OptionCard>
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

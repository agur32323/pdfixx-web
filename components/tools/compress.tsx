"use client";

import { Cloud, Smartphone } from "lucide-react";
import { useState } from "react";

import { ilovepdf } from "@/lib/cloud";
import { useT } from "@/lib/i18n";
import { bytesOf, compressLossless, compressRaster } from "@/lib/pdf/engine";
import { takeCloudUse } from "@/lib/prefs";
import type { ToolDef } from "@/lib/tools";

import { checkCloud, CloudRemaining, cloudStage, DropZone, InputRow, JobFailure, OptionCard, outName, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { ChoiceList, formatBytes, Segmented } from "../ui";

type Level = "low" | "medium" | "high";

export default function CompressTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const job = useJob(tool);
  const [level, setLevel] = useState<Level>("medium");
  const [cloud, setCloud] = useState(true);

  const run = () =>
    job.run(async (c) => {
      const before = input.file.size;
      let out: Blob;
      if (cloud) {
        checkCloud(input.file, t);
        out = await ilovepdf({
          tool: "compress",
          file: input.file,
          password: input.password,
          params: { compression_level: { low: "low", medium: "recommended", high: "extreme" }[level] },
          onStage: (s) => c.stage(cloudStage(t)(s)),
          onProgress: c.progress,
          signal: c.signal,
        });
        takeCloudUse();
      } else if (level === "low") {
        c.stage(t("stageCompressing"));
        out = pdfBlob(await compressLossless(await bytesOf(input.file), input.password));
      } else {
        c.stage(t("stageRenderingPages"));
        const bytes = await compressRaster(
          await bytesOf(input.file),
          { dpi: level === "medium" ? 150 : 100, quality: level === "medium" ? 0.72 : 0.5, password: input.password },
          (done, total) => c.progress(done / total),
        );
        out = pdfBlob(bytes);
      }
      if (out.size >= before * 0.98) throw new JobFailure(t("compressNoGain"));
      const percent = Math.round((1 - out.size / before) * 100);
      return {
        outputs: [{ blob: out, name: outName(input.file.name, "_compressed") }],
        summary: t("compressSaved", { percent, before: formatBytes(before, t.lang), after: formatBytes(out.size, t.lang) }),
      };
    });

  const rasterWarning = !cloud && level !== "low";
  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => setInputs([])}
      action={input ? { label: t("compressAction"), onClick: run, hint: t("originalSize", { size: formatBytes(input.file.size, t.lang) }) } : undefined}
    >
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          <OptionCard title={t("compressLevel")}>
            <ChoiceList<Level>
              value={level}
              onChange={setLevel}
              options={[
                { value: "low", title: t("compressLow"), sub: t("compressLowSub") },
                { value: "medium", title: t("compressMedium"), sub: t("compressMediumSub") },
                { value: "high", title: t("compressHigh"), sub: t("compressHighSub") },
              ]}
            />
          </OptionCard>
          <OptionCard title={t("compressWhere")}>
            <Segmented
              value={cloud ? "cloud" : "device"}
              onChange={(v) => setCloud(v === "cloud")}
              options={[
                {
                  value: "cloud",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Cloud className="size-4" /> {t("cloud")}
                    </span>
                  ),
                },
                {
                  value: "device",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Smartphone className="size-4" /> {t("onDevice")}
                    </span>
                  ),
                },
              ]}
            />
            <div className="mt-3 text-[13px] text-fg-2">
              {cloud ? <CloudRemaining /> : rasterWarning ? t("compressRasterWarning") : t("offlineNote")}
            </div>
          </OptionCard>
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

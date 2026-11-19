"use client";

import { Link2, Link2Off, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import { useT } from "@/lib/i18n";
import { extOf, formatOf, type ImageFormat, shrink } from "@/lib/image";
import type { ToolDef } from "@/lib/tools";

import { AddMore, DropZone, type InputFile, OptionCard, outName, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { ChoiceList, cx, Field, formatBytes, IconButton, Segmented, TextInput, useObjectUrl } from "../ui";

type Level = "high" | "balanced" | "small" | "target";
type Format = "same" | ImageFormat;
type ResizeMode = "percent" | "long" | "pixels";

const LEVELS: Record<Exclude<Level, "target">, { quality: number; maxSide: number }> = {
  high: { quality: 0.85, maxSide: 4096 },
  balanced: { quality: 0.75, maxSide: 2560 },
  small: { quality: 0.6, maxSide: 1600 },
};

function Thumb({ input, onRemove }: { input: InputFile; onRemove: () => void }) {
  const t = useT();
  const url = useObjectUrl(input.file);
  return (
    <div className="relative rounded-2xl border border-line bg-surface p-1.5">
      <div className="aspect-square overflow-hidden rounded-xl bg-surface-alt">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="" className="size-full object-cover" draggable={false} />}
      </div>
      <div className="mt-1.5 truncate px-1 text-[12px] font-medium">{input.file.name}</div>
      <div className="px-1 text-[12px] text-fg-3">{formatBytes(input.file.size, t.lang)}</div>
      <IconButton label={t("remove")} className="absolute top-2.5 right-2.5 size-7 bg-black/55 text-white hover:bg-black/70 hover:text-white" onClick={onRemove}>
        <X className="size-4" />
      </IconButton>
    </div>
  );
}

/** "Fotoğraf Küçült" (smaller files) and "Fotoğraf Boyutlandır" (exact dimensions). */
export default function ImageShrinkTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const resize = tool.id === "image_resize";
  const { inputs, setInputs, add } = useInputs({ multiple: true });
  const job = useJob(tool);
  const [level, setLevel] = useState<Level>("balanced");
  // Number fields keep what is typed; limits apply when the job runs.
  const [targetKb, setTargetKb] = useState("500");
  const [format, setFormat] = useState<Format>(resize ? "same" : "jpeg");
  const [mode, setMode] = useState<ResizeMode>("percent");
  const [percent, setPercent] = useState(50);
  const [longEdge, setLongEdge] = useState(1920);
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");
  const clampPx = (v: string) => Math.max(16, Math.min(10000, Math.round(Number(v)) || 16));
  const [keepRatio, setKeepRatio] = useState(true);
  const total = inputs.reduce((n, i) => n + i.file.size, 0);

  const run = () =>
    job.run(async (c) => {
      c.stage(t("stageCompressing"));
      const outputs = [];
      let before = 0;
      let after = 0;
      for (let i = 0; i < inputs.length; i++) {
        const file = inputs[i].file;
        const fmt: ImageFormat = format === "same" ? formatOf(file) : format;
        // A target size needs a lossy format.
        const used: ImageFormat = !resize && level === "target" && fmt === "png" ? "jpeg" : fmt;
        let res: { blob: Blob };
        if (resize) {
          const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
          const w0 = bmp.width;
          const h0 = bmp.height;
          bmp.close();
          const dims =
            mode === "percent"
              ? { width: Math.round((w0 * percent) / 100), height: Math.round((h0 * percent) / 100) }
              : mode === "long"
                ? { maxSide: longEdge }
                : keepRatio
                  ? { width: clampPx(width) }
                  : { width: clampPx(width), height: clampPx(height) };
          res = await shrink(file, { format: fmt, quality: 0.9, ...dims });
        } else {
          res =
            level === "target"
              ? await shrink(file, { format: used, quality: 0.85, maxSide: 4096, targetBytes: Math.max(20, Number(targetKb) || 500) * 1024 })
              : await shrink(file, { format: fmt, ...LEVELS[level] });
          // Never hand back a bigger file than the original.
          if (res.blob.size >= file.size && format === "same") res = { blob: file };
        }
        before += file.size;
        after += res.blob.size;
        const ext = res.blob === file ? (file.name.split(".").pop() ?? "jpg") : extOf(used);
        outputs.push({ blob: res.blob, name: outName(file.name, resize ? "_resized" : "_small", ext) });
        c.progress((i + 1) / inputs.length);
        if (c.signal.aborted) break;
      }
      const percentSaved = Math.max(0, Math.round((1 - after / before) * 100));
      return {
        outputs,
        summary: resize ? undefined : t("compressSaved", { percent: percentSaved, before: formatBytes(before, t.lang), after: formatBytes(after, t.lang) }),
      };
    });

  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => setInputs([])}
      action={
        inputs.length
          ? { label: resize ? t("webResizeAction") : t("webShrinkAction"), onClick: run, hint: t("webOriginalTotal", { count: inputs.length, size: formatBytes(total, t.lang) }) }
          : undefined
      }
    >
      {!inputs.length ? (
        <DropZone accept={tool.accept} multiple onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {inputs.map((i) => (
              <Thumb key={i.key} input={i} onRemove={() => setInputs((l) => l.filter((x) => x.key !== i.key))} />
            ))}
          </div>
          <AddMore accept={tool.accept} onFiles={add} />

          {resize ? (
            <OptionCard title={t("webResizeBy")}>
              <Segmented<ResizeMode>
                value={mode}
                onChange={setMode}
                options={[
                  { value: "percent", label: t("webResizePercent") },
                  { value: "long", label: t("webResizeLong") },
                  { value: "pixels", label: t("webResizePixels") },
                ]}
              />
              <div className="mt-4">
                {mode === "percent" && (
                  <Segmented value={percent} onChange={setPercent} options={[25, 50, 75].map((p) => ({ value: p, label: `%${p}` }))} />
                )}
                {mode === "long" && (
                  <Segmented value={longEdge} onChange={setLongEdge} options={[1080, 1920, 2560, 3840].map((p) => ({ value: p, label: `${p}px` }))} />
                )}
                {mode === "pixels" && (
                  <div className="flex items-end gap-2">
                    <Field label={t("webWidth")}>
                      <TextInput type="number" inputMode="numeric" min={16} max={10000} value={width} onChange={(e) => setWidth(e.target.value)} />
                    </Field>
                    <IconButton label={t("webKeepRatio")} className={cx("mb-1 border", keepRatio ? "border-brand text-brand" : "border-line")} onClick={() => setKeepRatio((k) => !k)}>
                      {keepRatio ? <Link2 className="size-5" /> : <Link2Off className="size-5" />}
                    </IconButton>
                    <Field label={t("webHeight")}>
                      <TextInput
                        type="number"
                        inputMode="numeric"
                        min={16}
                        max={10000}
                        disabled={keepRatio}
                        value={keepRatio ? "" : height}
                        placeholder="auto"
                        onChange={(e) => setHeight(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </OptionCard>
          ) : (
            <OptionCard title={t("webShrinkLevel")}>
              <ChoiceList<Level>
                value={level}
                onChange={setLevel}
                options={[
                  { value: "high", title: t("webShrinkHigh"), sub: t("webShrinkHighSub") },
                  { value: "balanced", title: t("webShrinkBalanced"), sub: t("webShrinkBalancedSub") },
                  { value: "small", title: t("webShrinkSmall"), sub: t("webShrinkSmallSub") },
                  { value: "target", title: t("webShrinkTarget"), sub: t("webShrinkTargetSub") },
                ]}
              />
              {level === "target" && (
                <div className="mt-4">
                  <Field label={t("webShrinkTargetLabel")}>
                    <TextInput type="number" inputMode="numeric" min={20} value={targetKb} onChange={(e) => setTargetKb(e.target.value)} />
                  </Field>
                </div>
              )}
            </OptionCard>
          )}

          <OptionCard title={t("imageFormat")}>
            <Segmented<Format>
              value={format}
              onChange={setFormat}
              options={[
                { value: "same", label: t("webFormatSame") },
                { value: "jpeg", label: "JPG" },
                { value: "webp", label: "WebP" },
                ...(resize ? [{ value: "png" as Format, label: "PNG" }] : []),
              ]}
            />
            <p className="mt-4 flex items-start gap-2 text-[13px] text-fg-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              {t("webExifNote")} {t("offlineNote")}
            </p>
          </OptionCard>
        </div>
      )}
    </ToolScaffold>
  );
}

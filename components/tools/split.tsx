"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { useT } from "@/lib/i18n";
import { bytesOf, extract, extractMany, parseRanges } from "@/lib/pdf/engine";
import type { ToolDef } from "@/lib/tools";

import { PageThumb, usePdfDoc } from "../thumbs";
import { DropZone, InputRow, OptionCard, outName, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { ChoiceList, cx, Field, Switch, TextInput } from "../ui";

type Mode = "ranges" | "every" | "all" | "select";

export default function SplitTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const total = input?.pages ?? 0;
  const { doc } = usePdfDoc(input?.file, input?.password);
  const job = useJob(tool);
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState("");
  const [mergeRanges, setMergeRanges] = useState(false);
  const [every, setEvery] = useState(2);
  const [picked, setPicked] = useState<number[]>([]);

  const [forFile, setForFile] = useState(input);
  if (forFile !== input) {
    setForFile(input);
    setRanges(total >= 3 ? "1-3" : "1");
    setPicked([]);
  }

  const parsed = mode === "ranges" ? parseRanges(ranges, total) : null;
  const groups: number[][] | null =
    mode === "ranges"
      ? parsed && (mergeRanges ? [parsed.flat()] : parsed)
      : mode === "every"
        ? Array.from({ length: Math.ceil(total / Math.max(1, every)) }, (_, g) =>
            Array.from({ length: Math.min(every, total - g * every) }, (_, i) => g * every + i),
          )
        : mode === "all"
          ? Array.from({ length: total }, (_, i) => [i])
          : picked.length
            ? [[...picked].sort((a, b) => a - b)]
            : null;

  const run = () =>
    job.run(async (c) => {
      c.stage(t("stageSplitting"));
      const bytes = await bytesOf(input.file);
      const label = (g: number[]) => (g.length === 1 ? `${g[0] + 1}` : `${g[0] + 1}-${g[g.length - 1] + 1}`);
      if (groups!.length === 1) {
        const out = await extract(bytes, groups![0], input.password);
        return { outputs: [{ blob: pdfBlob(out), name: outName(input.file.name, `_${mode === "select" ? "pages" : label(groups![0])}`) }] };
      }
      const outs = await extractMany(bytes, groups!, input.password);
      return {
        outputs: outs.map((o, i) => ({ blob: pdfBlob(o), name: outName(input.file.name, `_${label(groups![i])}`) })),
      };
    });

  const count = groups?.length ?? 0;
  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => setInputs([])}
      action={
        input
          ? {
              label: mode === "select" ? t("extractAction") : t("splitAction"),
              onClick: run,
              disabled: !groups || !count,
              hint: mode === "select" ? t("selectedPages", { count: picked.length }) : groups ? t("splitWillCreate", { count }) : undefined,
            }
          : undefined
      }
    >
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          <OptionCard title={t("splitMode")}>
            <ChoiceList<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: "ranges", title: t("splitModeRanges"), sub: t("splitModeRangesSub") },
                { value: "every", title: t("splitModeEvery"), sub: t("splitModeEverySub") },
                { value: "all", title: t("splitModeAll"), sub: t("splitModeAllSub") },
                { value: "select", title: t("splitModeSelect"), sub: t("splitModeSelectSub") },
              ]}
            />
          </OptionCard>

          {mode === "ranges" && (
            <OptionCard>
              <Field label={t("splitRangesLabel")} error={ranges && !parsed ? t("splitRangesInvalid", { max: total }) : null} hint={t("viewerPageRange", { total })}>
                <TextInput value={ranges} onChange={(e) => setRanges(e.target.value)} inputMode="numeric" placeholder="1-3, 5, 8-10" autoComplete="off" />
              </Field>
              <div className="mt-4">
                <Switch checked={mergeRanges} onChange={setMergeRanges} label={t("splitMergeRanges")} />
              </div>
            </OptionCard>
          )}

          {mode === "every" && (
            <OptionCard>
              <Field label={t("splitEveryLabel")}>
                <TextInput
                  type="number"
                  min={1}
                  max={total}
                  value={every}
                  inputMode="numeric"
                  onChange={(e) => setEvery(Math.max(1, Math.min(total, Number(e.target.value) || 1)))}
                />
              </Field>
            </OptionCard>
          )}

          {mode === "select" && doc && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: doc.numPages }, (_, i) => {
                const on = picked.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => setPicked((s) => (on ? s.filter((x) => x !== i) : [...s, i]))}
                    className={cx(
                      "press relative rounded-2xl border bg-surface p-2",
                      on ? "border-brand ring-4 ring-[color-mix(in_srgb,var(--brand)_14%,transparent)]" : "border-line",
                    )}
                  >
                    <PageThumb doc={doc} index={i} />
                    <span
                      className={cx(
                        "absolute top-3 right-3 grid size-6 place-items-center rounded-full border-2",
                        on ? "border-brand bg-brand text-white" : "border-white bg-black/10",
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <div className="mt-1.5 text-center text-[12px] font-semibold text-fg-2">{i + 1}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

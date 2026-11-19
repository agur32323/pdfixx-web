"use client";

import { useState } from "react";

import { useT } from "@/lib/i18n";
import { bytesOf, type NumberFormat, type NumberPosition, pageNumbers } from "@/lib/pdf/engine";
import type { ToolDef } from "@/lib/tools";

import { PageThumb, usePdfDoc } from "../thumbs";
import { DropZone, InputRow, OptionCard, outName, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { cx, Field, Segmented, Slider, Switch, TextInput } from "../ui";

const POSITIONS: NumberPosition[] = ["tl", "tc", "tr", "bl", "bc", "br"];

export default function PageNumbersTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const { doc } = usePdfDoc(input?.file, input?.password);
  const job = useJob(tool);
  const [position, setPosition] = useState<NumberPosition>("bc");
  const [format, setFormat] = useState<NumberFormat>("n");
  const [startAt, setStartAt] = useState(1);
  const [skipFirst, setSkipFirst] = useState(false);
  const [size, setSize] = useState(11);
  const total = input?.pages ?? 1;
  const sample = format === "n" ? `${startAt}` : format === "page_n" ? `${t("pnPageWord")} ${startAt}` : `${startAt} / ${startAt + total - (skipFirst ? 2 : 1)}`;

  const run = () =>
    job.run(async (c) => {
      c.stage(t("stagePageNumbers"));
      const out = await pageNumbers(await bytesOf(input.file), { position, format, startAt, skipFirst, size, pageWord: t("pnPageWord") }, input.password);
      return { outputs: [{ blob: pdfBlob(out), name: outName(input.file.name, "_numbered") }] };
    });

  return (
    <ToolScaffold tool={tool} job={job} onNewFile={() => setInputs([])} action={input ? { label: t("pnAction"), onClick: run } : undefined}>
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
          <div className="grid gap-4">
            <InputRow input={input} onChange={() => setInputs([])} />
            <OptionCard title={t("position")}>
              <div className="mx-auto grid aspect-[1/1.2] max-w-[180px] grid-rows-[auto_1fr_auto] rounded-2xl border border-line bg-surface-alt p-2">
                {[0, 1].map((row) => (
                  <div key={row} className={cx("grid grid-cols-3 gap-2", row === 1 && "row-start-3")}>
                    {POSITIONS.slice(row * 3, row * 3 + 3).map((p) => (
                      <button
                        key={p}
                        aria-label={p}
                        onClick={() => setPosition(p)}
                        className={cx("press h-9 rounded-lg border", position === p ? "border-brand bg-brand" : "border-line bg-surface hover:border-fg-3")}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </OptionCard>
            <OptionCard title={t("format")}>
              <Segmented
                value={format}
                onChange={setFormat}
                options={[
                  { value: "n", label: "1" },
                  { value: "page_n", label: `${t("pnPageWord")} 1` },
                  { value: "n_of_total", label: "1 / N" },
                ]}
              />
              <div className="mt-4 grid gap-4">
                <Field label={t("pnStartAt")}>
                  <TextInput type="number" min={0} inputMode="numeric" value={startAt} onChange={(e) => setStartAt(Math.max(0, Number(e.target.value) || 0))} />
                </Field>
                <Switch checked={skipFirst} onChange={setSkipFirst} label={t("pnSkipFirst")} sub={t("pnSkipFirstSub")} />
                <Slider label={t("textSize")} min={8} max={24} value={size} onChange={setSize} format={(v) => `${v} pt`} />
              </div>
            </OptionCard>
          </div>
          {doc && (
            <div className="card sticky top-4 p-3">
              <div className="mb-2 text-[13px] font-semibold text-fg-2">{t("preview")}</div>
              <div className="relative [container-type:inline-size]">
                <PageThumb doc={doc} index={skipFirst && doc.numPages > 1 ? 1 : 0} width={280} />
                <span
                  className={cx(
                    "pointer-events-none absolute font-medium text-[#344054]",
                    position.startsWith("t") ? "top-[5cqw]" : "bottom-[5cqw]",
                    position.endsWith("l") ? "left-[6cqw]" : position.endsWith("r") ? "right-[6cqw]" : "left-1/2 -translate-x-1/2",
                  )}
                  style={{ fontSize: `${(size / 595) * 100}cqw` }}
                >
                  {sample}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

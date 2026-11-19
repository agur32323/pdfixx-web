"use client";

import { GripVertical } from "lucide-react";

import { useT } from "@/lib/i18n";
import { bytesOf, merge } from "@/lib/pdf/engine";
import type { ToolDef } from "@/lib/tools";

import { Sortable } from "../sortable";
import { AddMore, DropZone, InputRow, outName, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { cx, formatBytes } from "../ui";

export default function MergeTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs({ multiple: true });
  const job = useJob(tool);
  const pages = inputs.reduce((n, i) => n + (i.pages ?? 0), 0);
  const size = inputs.reduce((n, i) => n + i.file.size, 0);

  const run = () =>
    job.run(async (c) => {
      c.stage(t("stageMerging"));
      const parts = [];
      for (const i of inputs) parts.push({ bytes: await bytesOf(i.file), password: i.password });
      const bytes = await merge(parts, (done) => c.progress(done / parts.length));
      return { outputs: [{ blob: pdfBlob(bytes), name: outName(inputs[0].file.name, "_merged", "pdf") }] };
    });

  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => setInputs([])}
      action={
        inputs.length
          ? {
              label: t("mergeAction", { count: inputs.length }),
              onClick: run,
              disabled: inputs.length < 2,
              hint: inputs.length < 2 ? t("mergeNeedTwo") : t("mergeTotal", { pages, size: formatBytes(size, t.lang) }),
            }
          : undefined
      }
    >
      {inputs.length === 0 ? (
        <DropZone accept={tool.accept} multiple onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <p className="text-[13px] text-fg-2">{t("mergeReorderHint")}</p>
          <Sortable items={inputs} getId={(i) => i.key} onReorder={setInputs} className="grid gap-2">
            {(input, index, handle, dragging) => (
              <div className={cx("flex items-center gap-2 transition-transform", dragging && "scale-[1.02] [&>div]:shadow-float")}>
                <button
                  {...handle.attributes}
                  {...handle.listeners}
                  aria-label={t("mergeReorderHint")}
                  className="grid h-12 w-8 shrink-0 cursor-grab touch-none place-items-center text-fg-3 active:cursor-grabbing"
                >
                  <GripVertical className="size-5" />
                </button>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-alt text-[13px] font-bold tabular-nums text-fg-2">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <InputRow input={input} onRemove={() => setInputs((list) => list.filter((x) => x.key !== input.key))} />
                </div>
              </div>
            )}
          </Sortable>
          <AddMore accept={tool.accept} onFiles={add} label={t("mergeAddMore")} />
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

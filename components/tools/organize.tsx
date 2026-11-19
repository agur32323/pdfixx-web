"use client";

import { Check, RotateCcw, RotateCw, Trash, Undo2 } from "lucide-react";
import { useState } from "react";

import { useT } from "@/lib/i18n";
import { bytesOf, organize, rotate } from "@/lib/pdf/engine";
import type { ToolDef } from "@/lib/tools";

import { PageThumb, usePdfDoc } from "../thumbs";
import { Sortable } from "../sortable";
import { DropZone, InputRow, outName, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { Button, cx, Spinner } from "../ui";

type PageItem = { key: string; index: number; rotation: number; deleted: boolean };

/** "Sayfaları Düzenle" (reorder, rotate, delete) and "PDF Döndür" (rotate only). */
export default function OrganizeTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const rotateOnly = tool.id === "rotate";
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const { doc } = usePdfDoc(input?.file, input?.password);
  const job = useJob(tool);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [forDoc, setForDoc] = useState(doc);
  if (forDoc !== doc) {
    // A new document: start from its pages in order.
    setForDoc(doc);
    setSelected([]);
    setPages(doc ? Array.from({ length: doc.numPages }, (_, i) => ({ key: `p${i}`, index: i, rotation: 0, deleted: false })) : []);
  }

  const kept = pages.filter((p) => !p.deleted);
  const deleted = pages.length - kept.length;
  const changed = pages.some((p, i) => p.index !== i || p.rotation % 360 !== 0 || p.deleted);
  const turned = pages.some((p) => p.rotation % 360 !== 0);

  const update = (keys: string[], fn: (p: PageItem) => PageItem) => setPages((list) => list.map((p) => (keys.includes(p.key) ? fn(p) : p)));
  const turn = (keys: string[], by: number) => update(keys, (p) => ({ ...p, rotation: p.rotation + by }));

  const run = () =>
    job.run(async (c) => {
      const bytes = await bytesOf(input.file);
      if (rotateOnly) {
        c.stage(t("stageRotating"));
        const out = await rotate(
          bytes,
          pages.map((p) => ((p.rotation % 360) + 360) % 360),
          input.password,
        );
        return { outputs: [{ blob: pdfBlob(out), name: outName(input.file.name, "_rotated") }] };
      }
      c.stage(t("stageOrganizing"));
      const out = await organize(
        bytes,
        kept.map((p) => ({ index: p.index, rotation: ((p.rotation % 360) + 360) % 360 })),
        input.password,
      );
      return { outputs: [{ blob: pdfBlob(out), name: outName(input.file.name, "_organized") }] };
    });

  const action = !input
    ? undefined
    : rotateOnly
      ? { label: t("rotateAction"), onClick: run, disabled: !turned, hint: turned ? undefined : t("rotateNothing") }
      : {
          label: t("organizeAction"),
          onClick: run,
          disabled: !changed || kept.length === 0,
          hint: kept.length === 0 ? t("organizeAllDeleted") : changed ? t("organizeSummary", { pages: kept.length, deleted }) : t("organizeNoChanges"),
        };

  return (
    <ToolScaffold tool={tool} job={job} onNewFile={() => setInputs([])} action={action}>
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          <div className="sticky top-[calc(56px+env(safe-area-inset-top,0px))] z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl bg-bg/90 px-1 py-2 backdrop-blur-xl md:top-0">
            {rotateOnly ? (
              <>
                <span className="mr-auto text-[13px] text-fg-2">{t("rotateHint")}</span>
                <span className="text-[13px] font-semibold text-fg-2">{t("rotateAll")}:</span>
                <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => turn(pages.map((p) => p.key), -90)}>
                  {t("rotateLeft")}
                </Button>
                <Button variant="secondary" size="sm" icon={<RotateCw className="size-4" />} onClick={() => turn(pages.map((p) => p.key), 90)}>
                  {t("rotateRight")}
                </Button>
                {turned && (
                  <Button variant="ghost" size="sm" icon={<Undo2 className="size-4" />} onClick={() => update(pages.map((p) => p.key), (p) => ({ ...p, rotation: 0 }))}>
                    {t("reset")}
                  </Button>
                )}
              </>
            ) : selected.length ? (
              <>
                <span className="mr-auto text-[13px] font-semibold">{t("selectedPages", { count: selected.length })}</span>
                <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => turn(selected, -90)}>
                  {t("rotateLeft")}
                </Button>
                <Button variant="secondary" size="sm" icon={<RotateCw className="size-4" />} onClick={() => turn(selected, 90)}>
                  {t("rotateRight")}
                </Button>
                {pages.filter((p) => selected.includes(p.key)).every((p) => p.deleted) ? (
                  <Button variant="secondary" size="sm" icon={<Undo2 className="size-4" />} onClick={() => update(selected, (p) => ({ ...p, deleted: false }))}>
                    {t("restore")}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="text-danger" icon={<Trash className="size-4" />} onClick={() => update(selected, (p) => ({ ...p, deleted: true }))}>
                    {t("delete")}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                  {t("selectNone")}
                </Button>
              </>
            ) : (
              <>
                <span className="mr-auto text-[13px] text-fg-2">{t("organizeHint")}</span>
                <Button variant="ghost" size="sm" onClick={() => setSelected(pages.map((p) => p.key))}>
                  {t("selectAll")}
                </Button>
              </>
            )}
          </div>

          {!doc ? (
            <div className="grid place-items-center py-20">
              <Spinner className="size-6" />
            </div>
          ) : (
            <Sortable
              items={pages}
              getId={(p) => p.key}
              onReorder={rotateOnly ? () => {} : setPages}
              grid
              className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5"
            >
              {(p, i, handle, dragging) => {
                const on = selected.includes(p.key);
                return (
                  <button
                    {...(rotateOnly ? {} : handle.attributes)}
                    {...(rotateOnly ? {} : handle.listeners)}
                    onClick={() =>
                      rotateOnly ? turn([p.key], 90) : setSelected((s) => (on ? s.filter((x) => x !== p.key) : [...s, p.key]))
                    }
                    className={cx(
                      "press group relative block w-full rounded-2xl border bg-surface p-2 text-left",
                      on ? "border-brand ring-4 ring-[color-mix(in_srgb,var(--brand)_14%,transparent)]" : "border-line",
                      dragging && "shadow-float",
                      !rotateOnly && "touch-manipulation",
                    )}
                  >
                    <div className={cx("transition-opacity", p.deleted && "opacity-25")}>
                      <PageThumb doc={doc} index={p.index} rotation={p.rotation} />
                    </div>
                    {p.deleted && (
                      <span className="absolute inset-0 grid place-items-center">
                        <Trash className="size-7 text-danger" />
                      </span>
                    )}
                    {!rotateOnly && (
                      <span
                        className={cx(
                          "absolute top-3 right-3 grid size-6 place-items-center rounded-full border-2",
                          on ? "border-brand bg-brand text-white" : "border-white bg-black/10 opacity-0 group-hover:opacity-100",
                        )}
                      >
                        {on && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                    )}
                    {rotateOnly && p.rotation % 360 !== 0 && (
                      <span className="absolute top-3 right-3 rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
                        {((p.rotation % 360) + 360) % 360}°
                      </span>
                    )}
                    <div className="mt-1.5 text-center text-[12px] font-semibold text-fg-2 tabular-nums">{rotateOnly ? p.index + 1 : i + 1}</div>
                  </button>
                );
              }}
            </Sortable>
          )}
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

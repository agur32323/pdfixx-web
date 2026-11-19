"use client";

import { Plus, Trash, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n";
import { bytesOf, type Placement, placeImages } from "@/lib/pdf/engine";
import { signaturesPref, usePref } from "@/lib/prefs";
import type { ToolDef } from "@/lib/tools";

import { PageStage } from "../page-stage";
import { usePdfDoc } from "../thumbs";
import { DropZone, InputRow, JobFailure, OptionCard, outName, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { Button, cx, IconButton, Sheet, Switch } from "../ui";

type Stroke = { x: number; y: number; w: number }[];
const INKS = ["#101828", "#1849A9", "#C81E3A"];

/** Draw a signature with a finger, stylus or mouse; returns a trimmed PNG. */
function SignaturePad({ onDone, onCancel }: { onDone: (png: string) => void; onCancel: () => void }) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [ink, setInk] = useState(INKS[0]);
  const current = useRef<Stroke | null>(null);

  const draw = (list: Stroke[]) => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of list) {
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(s[0].x, s[0].y, s[0].w / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1];
        const b = s[i];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.lineWidth = (a.w + b.w) / 2;
        ctx.beginPath();
        ctx.moveTo(i === 1 ? a.x : (s[i - 2].x + a.x) / 2, i === 1 ? a.y : (s[i - 2].y + a.y) / 2);
        ctx.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
        ctx.stroke();
      }
    }
  };

  useEffect(() => {
    const c = canvas.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    c.getContext("2d")!.scale(dpr, dpr);
  }, []);
  useEffect(() => draw(strokes));

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    // Faster strokes get thinner, like ink.
    const prev = current.current?.at(-1);
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const speed = prev ? Math.hypot(x - prev.x, y - prev.y) : 0;
    const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    const w = Math.max(1.4, Math.min(4.2, 3.4 * pressure * 2 - speed * 0.08));
    return { x, y, w: prev ? prev.w * 0.6 + w * 0.4 : w };
  };

  const finish = () => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
    if (maxX <= minX) return;
    const pad = 8;
    const out = document.createElement("canvas");
    out.width = maxX - minX + pad * 2;
    out.height = maxY - minY + pad * 2;
    out.getContext("2d")!.drawImage(c, minX - pad, minY - pad, out.width, out.height, 0, 0, out.width, out.height);
    onDone(out.toDataURL("image/png"));
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvas}
          data-vaul-no-drag
          className="h-56 w-full touch-none rounded-2xl border border-line bg-white"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            current.current = [point(e)];
            setStrokes((s) => [...s, current.current!]);
          }}
          onPointerMove={(e) => {
            if (!current.current) return;
            current.current.push(point(e));
            draw(strokes);
          }}
          onPointerUp={() => (current.current = null)}
          onPointerCancel={() => (current.current = null)}
        />
        {!strokes.length && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[15px] text-fg-3">{t("signPadHint")}</span>}
        <div className="pointer-events-none absolute right-6 bottom-12 left-6 border-b border-dashed border-line" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        {INKS.map((c) => (
          <button key={c} aria-label={c} onClick={() => setInk(c)} className={cx("press size-8 rounded-full", ink === c && "ring-2 ring-offset-2 ring-offset-surface")} style={{ background: c, ["--tw-ring-color" as string]: c }} />
        ))}
        <span className="flex-1" />
        <IconButton label={t("undo")} disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}>
          <Undo2 className="size-5" />
        </IconButton>
        <Button variant="ghost" size="sm" disabled={!strokes.length} onClick={() => setStrokes([])}>
          {t("clear")}
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button disabled={!strokes.length} onClick={finish}>
          {t("use")}
        </Button>
      </div>
    </div>
  );
}

/** A box you drag to move and pull by the corner to resize. Fractions of the page. */
function Placer({ box, aspect, src, onChange, page }: { box: Omit<Placement, "page">; aspect: number; src: string; onChange: (b: Omit<Placement, "page">) => void; page: { width: number; height: number } }) {
  const drag = useRef<{ mode: "move" | "resize"; x: number; y: number; start: Omit<Placement, "page"> } | null>(null);
  const onDown = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: box };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / page.width;
    const dy = (e.clientY - d.y) / page.height;
    if (d.mode === "move") {
      onChange({ ...d.start, x: Math.min(1 - d.start.w, Math.max(0, d.start.x + dx)), y: Math.min(1 - d.start.h, Math.max(0, d.start.y + dy)) });
    } else {
      const w = Math.min(1 - d.start.x, Math.max(0.08, d.start.w + dx));
      const h = (w * page.width) / aspect / page.height;
      if (d.start.y + h <= 1) onChange({ ...d.start, w, h });
    }
  };
  return (
    <div
      className="absolute cursor-move touch-none rounded-md outline-2 outline-offset-2 outline-brand outline-dashed"
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
      onPointerDown={onDown("move")}
      onPointerMove={onMove}
      onPointerUp={() => (drag.current = null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="pointer-events-none size-full select-none" draggable={false} />
      <span
        className="absolute -right-3 -bottom-3 size-6 cursor-nwse-resize rounded-full border-2 border-white bg-brand shadow"
        onPointerDown={onDown("resize")}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
      />
    </div>
  );
}

export default function SignTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const { doc } = usePdfDoc(input?.file, input?.password);
  const job = useJob(tool);
  const saved = usePref(signaturesPref);
  const [chosenSig, setSig] = useState<string | null>(null);
  const sig = chosenSig ?? saved[0] ?? null;
  const [aspect, setAspect] = useState(3);
  const [padOpen, setPadOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [boxes, setBoxes] = useState<Record<number, Omit<Placement, "page">>>({});
  const [applyAll, setApplyAll] = useState(false);

  useEffect(() => {
    if (!sig) return;
    const img = new Image();
    img.onload = () => setAspect(img.width / img.height);
    img.src = sig;
  }, [sig]);

  const boxFor = (p: number) => boxes[p];
  const placeDefault = (size: { width: number; height: number }) => {
    const w = 0.3;
    const h = (w * size.width) / aspect / size.height;
    setBoxes((b) => ({ ...b, [page]: { x: 0.6, y: Math.max(0, 0.86 - h), w, h } }));
  };

  const run = () =>
    job.run(async (c) => {
      if (!sig) throw new JobFailure(t("signNoSignature"));
      c.stage(t("stageSigning"));
      const png = await (await fetch(sig)).arrayBuffer();
      const pages = applyAll ? Array.from({ length: doc!.numPages }, (_, i) => i) : Object.keys(boxes).map(Number);
      const template = boxes[page] ?? Object.values(boxes)[0];
      const items = pages.map((p) => ({ png, at: { page: p, ...(applyAll ? template : boxes[p]) } }));
      const out = await placeImages(await bytesOf(input.file), items, input.password);
      return { outputs: [{ blob: pdfBlob(out), name: outName(input.file.name, "_signed") }] };
    });

  const placedCount = Object.keys(boxes).length;
  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => {
        setInputs([]);
        setBoxes({});
      }}
      action={input ? { label: t("signAction"), onClick: run, disabled: !sig || !placedCount, hint: sig ? t("signPlaceHint") : t("signNoSignature") } : undefined}
    >
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          <OptionCard title={t("signature")}>
            <div className="flex flex-wrap items-center gap-2">
              {saved.map((s) => (
                <div key={s.slice(-40)} className="group relative">
                  <button
                    onClick={() => setSig(s)}
                    className={cx("press grid h-16 w-32 place-items-center rounded-xl border bg-white p-2", sig === s ? "border-brand ring-4 ring-[color-mix(in_srgb,var(--brand)_14%,transparent)]" : "border-line")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s} alt="" className="max-h-full max-w-full" />
                  </button>
                  <button
                    aria-label={t("signDeleteSaved")}
                    onClick={() => {
                      signaturesPref.set((l) => l.filter((x) => x !== s));
                      if (sig === s) setSig(null);
                    }}
                    className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border border-line bg-surface text-fg-2 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash className="size-3" />
                  </button>
                </div>
              ))}
              <Button variant="secondary" className="h-16" icon={<Plus className="size-5" />} onClick={() => setPadOpen(true)}>
                {t("signCreate")}
              </Button>
            </div>
          </OptionCard>

          {doc && sig && (
            <>
              <PageStage doc={doc} page={page} onPage={setPage}>
                {(size) => {
                  const box = boxFor(page) ?? (applyAll ? Object.values(boxes)[0] : undefined);
                  return box ? (
                    <Placer box={box} aspect={aspect} src={sig} page={size} onChange={(b) => setBoxes((x) => ({ ...x, [page]: b }))} />
                  ) : (
                    <button className="absolute inset-0 grid place-items-center bg-black/0 hover:bg-black/5" onClick={() => placeDefault(size)}>
                      <span className="rounded-full bg-brand px-4 py-2 text-[14px] font-semibold text-white shadow-float">+ {t("signature")}</span>
                    </button>
                  );
                }}
              </PageStage>
              <div className="flex flex-wrap items-center gap-3">
                {boxFor(page) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash className="size-4" />}
                    onClick={() =>
                      setBoxes((b) => {
                        const n = { ...b };
                        delete n[page];
                        return n;
                      })
                    }
                  >
                    {t("remove")}
                  </Button>
                )}
                {doc.numPages > 1 && (
                  <div className="min-w-60 flex-1">
                    <Switch checked={applyAll} onChange={setApplyAll} label={t("signApplyAll")} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <Sheet open={padOpen} onClose={() => setPadOpen(false)} title={t("signPadTitle")}>
        <SignaturePad
          onCancel={() => setPadOpen(false)}
          onDone={(png) => {
            signaturesPref.set((l) => [png, ...l.filter((x) => x !== png)].slice(0, 4));
            setSig(png);
            setPadOpen(false);
          }}
        />
      </Sheet>
      {passwordSheet}
    </ToolScaffold>
  );
}


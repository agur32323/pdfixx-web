"use client";

import { Highlighter, Pencil, Redo2, Type, Undo2 } from "lucide-react";
import { useRef, useState } from "react";

import { useT } from "@/lib/i18n";
import { bytesOf, placeImages } from "@/lib/pdf/engine";
import { canvasToBlob } from "@/lib/pdf/render";
import type { ToolDef } from "@/lib/tools";

import { PageStage } from "../page-stage";
import { usePdfDoc } from "../thumbs";
import { DropZone, InputRow, JobFailure, outName, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { cx, IconButton } from "../ui";

type Mode = "pen" | "marker" | "text";
/** Positions are fractions of the page, so marks survive any zoom. */
type Mark =
  | { kind: "stroke"; page: number; mode: "pen" | "marker"; color: string; points: [number, number][] }
  | { kind: "text"; page: number; x: number; y: number; text: string; color: string };

const COLORS = { pen: ["#101828", "#E8394D", "#1849A9", "#12B76A"], marker: ["#FDE047", "#86EFAC", "#F9A8D4", "#93C5FD"], text: ["#101828", "#E8394D", "#1849A9"] };
const WIDTH = { pen: 0.004, marker: 0.022 };
const TEXT_SIZE = 0.03;

function pathOf(points: [number, number][], w: number, h: number) {
  if (!points.length) return "";
  const [x0, y0] = points[0];
  let d = `M${x0 * w} ${y0 * h}`;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    d += ` Q${ax * w} ${ay * h} ${((ax + bx) / 2) * w} ${((ay + by) / 2) * h}`;
  }
  if (points.length === 1) d += ` L${x0 * w + 0.1} ${y0 * h}`;
  return d;
}

export default function AnnotateTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const { doc } = usePdfDoc(input?.file, input?.password);
  const job = useJob(tool);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<Mode>("pen");
  const [color, setColor] = useState<Record<Mode, string>>({ pen: COLORS.pen[0], marker: COLORS.marker[0], text: COLORS.text[0] });
  const [marks, setMarks] = useState<Mark[]>([]);
  const [undone, setUndone] = useState<Mark[]>([]);
  const [editing, setEditing] = useState<{ x: number; y: number } | null>(null);
  const live = useRef<Mark | null>(null);
  const [, force] = useState(0);

  const commit = (m: Mark) => {
    setMarks((list) => [...list, m]);
    setUndone([]);
  };
  // Also on cancel: the browser can take a touch over mid-stroke.
  const finishStroke = () => {
    if (live.current) commit(live.current);
    live.current = null;
  };

  const run = () =>
    job.run(async (c) => {
      if (!marks.length) throw new JobFailure(t("organizeNoChanges"));
      c.stage(t("stageAnnotating"));
      const items = [];
      for (const p of [...new Set(marks.map((m) => m.page))]) {
        const pg = await doc!.getPage(p + 1);
        const vp = pg.getViewport({ scale: 1 });
        const W = 1800;
        const H = Math.round((W * vp.height) / vp.width);
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        for (const m of marks.filter((x) => x.page === p)) {
          if (m.kind === "stroke") {
            ctx.strokeStyle = m.color;
            ctx.globalAlpha = m.mode === "marker" ? 0.4 : 1;
            ctx.lineWidth = WIDTH[m.mode] * W;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke(new Path2D(pathOf(m.points, W, H)));
          } else {
            ctx.globalAlpha = 1;
            ctx.fillStyle = m.color;
            ctx.font = `600 ${TEXT_SIZE * W}px Inter, Roboto, sans-serif`;
            ctx.textBaseline = "top";
            m.text.split("\n").forEach((line, i) => ctx.fillText(line, m.x * W, m.y * H + i * TEXT_SIZE * W * 1.25));
          }
        }
        const png = await (await canvasToBlob(canvas, "image/png")).arrayBuffer();
        items.push({ png, at: { page: p, x: 0, y: 0, w: 1, h: 1 } });
      }
      const out = await placeImages(await bytesOf(input.file), items, input.password);
      return { outputs: [{ blob: pdfBlob(out), name: outName(input.file.name, "_edited") }] };
    });

  const pageMarks = marks.filter((m) => m.page === page);
  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => {
        setInputs([]);
        setMarks([]);
      }}
      action={input ? { label: t("save"), onClick: run, disabled: !marks.length, hint: t("markupHint") } : undefined}
    >
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          <div className="sticky top-[calc(56px+env(safe-area-inset-top,0px))] z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-2 backdrop-blur-xl md:top-2">
            {(
              [
                ["pen", t("markupPen"), Pencil],
                ["marker", t("markupMarker"), Highlighter],
                ["text", t("annText"), Type],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cx("press flex h-10 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold", mode === m ? "bg-fg text-bg" : "text-fg-2 hover:bg-surface-alt")}
              >
                <Icon className="size-[18px]" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
            <span className="mx-1 h-6 w-px bg-line" />
            {COLORS[mode].map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => setColor((x) => ({ ...x, [mode]: c }))}
                className={cx("press size-7 rounded-full border border-black/10", color[mode] === c && "ring-2 ring-offset-2 ring-offset-surface")}
                style={{ background: c, ["--tw-ring-color" as string]: mode === "marker" ? "#A16207" : c }}
              />
            ))}
            <span className="flex-1" />
            <IconButton
              label={t("undo")}
              disabled={!marks.length}
              onClick={() => {
                const last = marks.at(-1)!;
                setMarks(marks.slice(0, -1));
                setUndone((u) => [...u, last]);
              }}
            >
              <Undo2 className="size-5" />
            </IconButton>
            <IconButton
              label={t("redo")}
              disabled={!undone.length}
              onClick={() => {
                const m = undone.at(-1)!;
                setUndone(undone.slice(0, -1));
                setMarks((list) => [...list, m]);
              }}
            >
              <Redo2 className="size-5" />
            </IconButton>
          </div>

          {doc && (
            <PageStage
              doc={doc}
              page={page}
              onPage={(p) => {
                setEditing(null);
                setPage(p);
              }}
            >
              {({ width, height }) => {
                const at = (e: React.PointerEvent): [number, number] => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
                };
                const all = live.current ? [...pageMarks, live.current] : pageMarks;
                return (
                  <div
                    className={cx("absolute inset-0 touch-none", mode === "text" ? "cursor-text" : "cursor-crosshair")}
                    onPointerDown={(e) => {
                      if (editing) return;
                      const [x, y] = at(e);
                      if (mode === "text") {
                        setEditing({ x, y });
                        return;
                      }
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      live.current = { kind: "stroke", page, mode, color: color[mode], points: [[x, y]] };
                      force((n) => n + 1);
                    }}
                    onPointerMove={(e) => {
                      const m = live.current;
                      if (m?.kind !== "stroke") return;
                      m.points.push(at(e));
                      force((n) => n + 1);
                    }}
                    onPointerUp={finishStroke}
                    onPointerCancel={finishStroke}
                    onLostPointerCapture={finishStroke}
                  >
                    <svg width={width} height={height} className="pointer-events-none absolute inset-0">
                      {all.map((m, i) =>
                        m.kind === "stroke" ? (
                          <path
                            key={i}
                            d={pathOf(m.points, width, height)}
                            fill="none"
                            stroke={m.color}
                            strokeOpacity={m.mode === "marker" ? 0.4 : 1}
                            strokeWidth={WIDTH[m.mode] * width}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : (
                          <text key={i} x={m.x * width} y={m.y * height} fill={m.color} fontWeight={600} fontSize={TEXT_SIZE * width} dominantBaseline="hanging">
                            {m.text.split("\n").map((line, j) => (
                              <tspan key={j} x={m.x * width} dy={j ? TEXT_SIZE * width * 1.25 : 0}>
                                {line}
                              </tspan>
                            ))}
                          </text>
                        ),
                      )}
                    </svg>
                    {editing && (
                      <textarea
                        autoFocus
                        rows={1}
                        placeholder={t("markupTextHint")}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            (e.target as HTMLTextAreaElement).blur();
                          }
                          if (e.key === "Escape") setEditing(null);
                        }}
                        onBlur={(e) => {
                          const text = e.target.value.trim();
                          if (text) commit({ kind: "text", page, x: editing.x, y: editing.y, text, color: color.text });
                          setEditing(null);
                        }}
                        className="absolute min-w-40 resize-none rounded-md border border-brand bg-white/90 px-1 font-semibold outline-none"
                        style={{ left: editing.x * width, top: editing.y * height, color: color.text, fontSize: Math.max(16, TEXT_SIZE * width), lineHeight: 1.25 }}
                      />
                    )}
                  </div>
                );
              }}
            </PageStage>
          )}
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

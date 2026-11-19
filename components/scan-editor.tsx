"use client";

import { Check, Maximize, RotateCw, ScanLine, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useT } from "@/lib/i18n";
import { applyFilter, canvasBlob, decode, detectPage, fit, FULL_QUAD, type Quad, type ScanFilter, warp } from "@/lib/image";

import { Button, cx, Spinner } from "./ui";

/**
 * Turns a photo of a document into a scan: find the page (adjustable by its
 * corners), straighten it and clean it up.
 */
export function ScanEditor({ file, onDone, onCancel }: { file: File; onDone: (file: File) => void; onCancel: () => void }) {
  const t = useT();
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [rotation, setRotation] = useState(0);
  const [quad, setQuad] = useState<Quad>(FULL_QUAD);
  const [step, setStep] = useState<"crop" | "filter">("crop");
  const [filter, setFilter] = useState<ScanFilter>("enhance");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    let bmp: ImageBitmap | undefined;
    void decode(file).then((b) => {
      bmp = b;
      setBitmap(b);
    });
    return () => bmp?.close();
  }, [file]);

  // Preview at screen size; the page is found again whenever it changes.
  const preview = useMemo(() => (bitmap ? fit(bitmap, 1400, rotation) : null), [bitmap, rotation]);
  const [detectedFor, setDetectedFor] = useState<HTMLCanvasElement | null>(null);
  if (preview && detectedFor !== preview) {
    setDetectedFor(preview);
    setQuad(detectPage(preview));
  }

  // Filter previews of the straightened page.
  const thumbs = useMemo(() => {
    const out: Partial<Record<ScanFilter, string>> = {};
    if (step !== "filter" || !preview) return out;
    const flat = warp(preview, quad, 700);
    for (const f of ["original", "enhance", "gray", "bw"] as ScanFilter[]) {
      const c = document.createElement("canvas");
      c.width = flat.width;
      c.height = flat.height;
      c.getContext("2d")!.drawImage(flat, 0, 0);
      out[f] = applyFilter(c, f).toDataURL("image/jpeg", 0.85);
    }
    return out;
  }, [step, preview, quad]);
  const url = useMemo(() => preview?.toDataURL("image/jpeg", 0.85), [preview]);

  const move = (e: React.PointerEvent) => {
    const i = drag.current;
    const el = box.current;
    if (i === null || !el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setQuad((q) => q.map((p, j) => (j === i ? { x, y } : p)) as Quad);
  };

  const save = async () => {
    if (!bitmap) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    const full = fit(bitmap, 3200, rotation);
    const flat = applyFilter(warp(full, quad, 2800), filter);
    const blob = await canvasBlob(flat, "image/jpeg", filter === "bw" ? 0.85 : 0.9);
    const base = file.name.replace(/\.[^.]+$/, "");
    onDone(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
  };

  const ratio = preview ? preview.width / preview.height : 0.75;
  const pts = quad.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");

  return (
    <div className="grid gap-4">
      {!preview ? (
        <div className="grid h-[50dvh] place-items-center">
          <Spinner className="size-6" />
        </div>
      ) : step === "crop" ? (
        <>
          <p className="text-[14px] text-fg-2">{t("webScanHint")}</p>
          <div className="grid place-items-center rounded-2xl bg-[#1b1d22] p-4">
            <div
              ref={box}
              data-vaul-no-drag
              className="relative touch-none select-none"
              style={{ aspectRatio: `${ratio}`, width: `min(100%, calc(56dvh * ${ratio}))` }}
              onPointerMove={move}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="absolute inset-0 size-full rounded-md" draggable={false} />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
                <defs>
                  <mask id="scan-mask">
                    <rect width="100" height="100" fill="white" />
                    <polygon points={pts} fill="black" />
                  </mask>
                </defs>
                <rect width="100" height="100" fill="rgb(0 0 0 / 0.45)" mask="url(#scan-mask)" />
                <polygon points={pts} fill="rgb(232 57 77 / 0.08)" stroke="#e8394d" strokeWidth="0.6" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
              </svg>
              {quad.map((p, i) => (
                <span
                  key={i}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
                    drag.current = i;
                  }}
                  className="absolute size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  <span className="absolute inset-2.5 rounded-full border-[3px] border-white bg-brand shadow-[0_2px_8px_rgb(0_0_0/0.5)]" />
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Wand2 className="size-4" />} onClick={() => preview && setQuad(detectPage(preview))}>
              {t("webScanAuto")}
            </Button>
            <Button variant="secondary" size="sm" icon={<Maximize className="size-4" />} onClick={() => setQuad(FULL_QUAD)}>
              {t("webScanFull")}
            </Button>
            <Button variant="secondary" size="sm" icon={<RotateCw className="size-4" />} onClick={() => setRotation((r) => (r + 90) % 360)}>
              {t("rotateRight")}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button icon={<ScanLine className="size-4" />} onClick={() => setStep("filter")}>
              {t("webScanNext")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid place-items-center rounded-2xl bg-surface-alt p-4">
            {thumbs[filter] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbs[filter]} alt="" className="max-h-[44dvh] rounded-md shadow-float" />
            ) : (
              <Spinner className="my-24 size-6" />
            )}
          </div>
          <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2">
            {(
              [
                ["original", t("webFilterOriginal")],
                ["enhance", t("webFilterEnhance")],
                ["gray", t("webFilterGray")],
                ["bw", t("webFilterBw")],
              ] as const
            ).map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)} className="press text-center">
                <span className={cx("relative block overflow-hidden rounded-xl border-2 bg-white", filter === f ? "border-brand" : "border-transparent")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[f] ? <img src={thumbs[f]} alt="" className="aspect-[3/4] w-full object-cover object-top" /> : <span className="block aspect-[3/4] animate-pulse bg-surface-alt" />}
                  {filter === f && (
                    <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-brand text-white">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className={cx("mt-1 block text-[12px] font-semibold", filter === f ? "text-brand" : "text-fg-2")}>{label}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setStep("crop")}>
              {t("webBack")}
            </Button>
            <Button loading={busy} onClick={save}>
              {t("use")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

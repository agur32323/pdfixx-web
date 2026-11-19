"use client";

import { useState } from "react";

import { convertApiFiles, type ConvertEndpoint } from "@/lib/cloud";
import { useT } from "@/lib/i18n";
import { takeCloudUse } from "@/lib/prefs";
import type { ToolDef } from "@/lib/tools";

import { checkCloud, CloudRemaining, cloudStage, DropZone, InputRow, OptionCard, outName, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { ChoiceList, Segmented, Switch } from "../ui";

type Space = "default" | "model" | "all";
type Paper = "default" | "a4" | "a3" | "a2" | "a1" | "a0";
type Color = "truecolors" | "grayscale" | "monochrome";
type Format = "png" | "jpg" | "svg";

/** DWG / DXF / DWF to PDF or images, through ConvertAPI's CAD engine. */
export default function CadTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const toImage = tool.id === "cad_image";
  const { inputs, setInputs, add } = useInputs();
  const input = inputs[0];
  const job = useJob(tool);
  const [space, setSpace] = useState<Space>("default");
  const [paper, setPaper] = useState<Paper>("default");
  const [landscape, setLandscape] = useState(true);
  const [color, setColor] = useState<Color>("truecolors");
  const [layers, setLayers] = useState(true);
  const [fit, setFit] = useState(true);
  const [format, setFormat] = useState<Format>("png");
  const [dpi, setDpi] = useState(300);

  const run = () =>
    job.run(async (c) => {
      checkCloud(input.file, t);
      const ext = (input.file.name.split(".").pop() ?? "dwg").toLowerCase();
      const from = (["dwg", "dxf", "dwf"].includes(ext) ? ext : "dwg") as "dwg" | "dxf" | "dwf";
      const endpoint = `${from}/to/${toImage ? format : "pdf"}` as ConvertEndpoint;
      const options: Record<string, unknown> = { SpaceToConvert: space, ColorSpace: color, ExportLayers: layers };
      if (toImage) {
        if (format !== "svg") options.ImageResolution = dpi;
      } else {
        options.AutoFit = fit;
        options.PageSize = paper;
        if (paper !== "default") options.PageOrientation = landscape ? "landscape" : "portrait";
      }
      const files = await convertApiFiles({
        endpoint,
        file: input.file,
        options,
        onStage: (s) => c.stage(cloudStage(t)(s)),
        onProgress: c.progress,
        signal: c.signal,
      });
      takeCloudUse();
      const outExt = toImage ? format : "pdf";
      const type = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml" }[outExt];
      return {
        outputs: files.map((f, i) => ({
          blob: new Blob([f.blob], { type }),
          name: files.length > 1 ? outName(input.file.name, `_${i + 1}`, outExt) : outName(input.file.name, "", outExt),
        })),
      };
    });

  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => setInputs([])}
      action={input ? { label: t("convertAction"), onClick: run, hint: t("convertOutput", { format: (toImage ? format : "pdf").toUpperCase() }) } : undefined}
    >
      {!input ? (
        <>
          <DropZone accept={tool.accept} onFiles={add} cloud />
          <p className="mt-4 text-center text-[13px] text-fg-3">{t("webCadFormats")}</p>
        </>
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          <OptionCard title={t("webCadSpace")}>
            <ChoiceList<Space>
              value={space}
              onChange={setSpace}
              options={[
                { value: "default", title: t("webCadSpaceDefault"), sub: t("webCadSpaceDefaultSub") },
                { value: "model", title: t("webCadSpaceModel"), sub: t("webCadSpaceModelSub") },
                { value: "all", title: t("webCadSpaceAll"), sub: t("webCadSpaceAllSub") },
              ]}
            />
          </OptionCard>
          {toImage ? (
            <OptionCard title={t("imageFormat")}>
              <Segmented
                value={format}
                onChange={setFormat}
                options={[
                  { value: "png", label: "PNG" },
                  { value: "jpg", label: "JPG" },
                  { value: "svg", label: "SVG" },
                ]}
              />
              {format !== "svg" && (
                <>
                  <div className="mt-4 mb-2 text-[13px] font-semibold text-fg-2">{t("webCadDpi")}</div>
                  <Segmented
                    value={dpi}
                    onChange={setDpi}
                    options={[150, 300, 600].map((d) => ({ value: d, label: `${d}` }))}
                  />
                </>
              )}
            </OptionCard>
          ) : (
            <OptionCard title={t("webCadPaper")}>
              <Segmented
                value={paper}
                onChange={setPaper}
                options={[
                  { value: "default", label: t("webCadPaperAuto") },
                  ...(["a4", "a3", "a2", "a1", "a0"] as const).map((p) => ({ value: p, label: p.toUpperCase() })),
                ]}
              />
              {paper !== "default" && (
                <div className="mt-3">
                  <Segmented
                    value={landscape ? "l" : "p"}
                    onChange={(v) => setLandscape(v === "l")}
                    options={[
                      { value: "l", label: t("orientationLandscape") },
                      { value: "p", label: t("orientationPortrait") },
                    ]}
                  />
                </div>
              )}
              <div className="mt-4">
                <Switch checked={fit} onChange={setFit} label={t("webCadFit")} sub={t("webCadFitSub")} />
              </div>
            </OptionCard>
          )}
          <OptionCard title={t("webCadColor")}>
            <Segmented
              value={color}
              onChange={setColor}
              options={[
                { value: "truecolors", label: t("webCadColorTrue") },
                { value: "grayscale", label: t("webCadColorGray") },
                { value: "monochrome", label: t("webCadColorMono") },
              ]}
            />
            {!toImage && (
              <div className="mt-4">
                <Switch checked={layers} onChange={setLayers} label={t("webCadLayers")} sub={t("webCadLayersSub")} />
              </div>
            )}
            {!toImage && <p className="mt-4 text-[13px] text-fg-2">{t("webCadVectorNote")}</p>}
            <div className="mt-3">
              <CloudRemaining />
            </div>
          </OptionCard>
        </div>
      )}
    </ToolScaffold>
  );
}

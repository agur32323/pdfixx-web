"use client";

import { useState } from "react";

import { convertApi, ilovepdf } from "@/lib/cloud";
import { useT } from "@/lib/i18n";
import { takeCloudUse } from "@/lib/prefs";
import type { ToolDef } from "@/lib/tools";

import { checkCloud, CloudRemaining, cloudStage, DropZone, InputRow, OptionCard, outName, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { Segmented } from "../ui";

type Spec =
  | { provider: "ilovepdf"; tool: "officepdf" | "pdfocr" | "repair"; outExt: "pdf"; suffix: string; ocr?: boolean }
  | { provider: "convertapi"; endpoint: "pdf/to/docx" | "pdf/to/xlsx" | "pdf/to/pptx"; outExt: string; suffix: string };

// Same mapping as the app (lib/ui/tools/convert_tool.dart).
const SPECS: Record<string, Spec> = {
  word_pdf: { provider: "ilovepdf", tool: "officepdf", outExt: "pdf", suffix: "" },
  excel_pdf: { provider: "ilovepdf", tool: "officepdf", outExt: "pdf", suffix: "" },
  ppt_pdf: { provider: "ilovepdf", tool: "officepdf", outExt: "pdf", suffix: "" },
  ocr: { provider: "ilovepdf", tool: "pdfocr", outExt: "pdf", suffix: "_ocr", ocr: true },
  repair: { provider: "ilovepdf", tool: "repair", outExt: "pdf", suffix: "_repaired" },
  pdf_word: { provider: "convertapi", endpoint: "pdf/to/docx", outExt: "docx", suffix: "" },
  pdf_excel: { provider: "convertapi", endpoint: "pdf/to/xlsx", outExt: "xlsx", suffix: "" },
  pdf_ppt: { provider: "convertapi", endpoint: "pdf/to/pptx", outExt: "pptx", suffix: "" },
};

type Lang = "tr" | "en" | "both";

export default function CloudConvertTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const spec = SPECS[tool.id];
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const job = useJob(tool);
  const [lang, setLang] = useState<Lang>(t.lang === "tr" ? "tr" : "en");
  const showLang = (spec.provider === "ilovepdf" && spec.ocr) || spec.provider === "convertapi";

  const run = () =>
    job.run(async (c) => {
      checkCloud(input.file, t);
      const common = { file: input.file, password: input.password, onStage: (s: Parameters<ReturnType<typeof cloudStage>>[0]) => c.stage(cloudStage(t)(s)), onProgress: c.progress, signal: c.signal };
      const blob =
        spec.provider === "ilovepdf"
          ? await ilovepdf({
              ...common,
              tool: spec.tool,
              params: spec.ocr ? { ocr_languages: lang === "both" ? ["tur", "eng"] : lang === "tr" ? ["tur"] : ["eng"] } : undefined,
            })
          : await convertApi({ ...common, endpoint: spec.endpoint, ocrLanguage: lang === "en" ? "en" : "tr" });
      takeCloudUse();
      const type =
        spec.outExt === "pdf"
          ? "application/pdf"
          : {
              docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            }[spec.outExt]!;
      return { outputs: [{ blob: new Blob([blob], { type }), name: outName(input.file.name, spec.suffix, spec.outExt) }] };
    });

  const pickLabel = tool.id === "word_pdf" ? t("selectWord") : tool.id === "excel_pdf" ? t("selectExcel") : tool.id === "ppt_pdf" ? t("selectPpt") : undefined;
  const actionLabel = tool.id === "ocr" ? t("ocrAction") : tool.id === "repair" ? t("repairAction") : t("convertAction");

  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => setInputs([])}
      action={input ? { label: actionLabel, onClick: run, hint: t("convertOutput", { format: spec.outExt.toUpperCase() }) } : undefined}
    >
      {!input ? (
        <>
          <DropZone accept={tool.accept} onFiles={add} cloud />
          {pickLabel && <span className="sr-only">{pickLabel}</span>}
        </>
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          {showLang && (
            <OptionCard title={t("ocrLanguage")}>
              <Segmented<Lang>
                value={lang}
                onChange={setLang}
                options={[
                  { value: "tr", label: t("langTurkish") },
                  { value: "en", label: t("langEnglish") },
                  ...(spec.provider === "ilovepdf" ? [{ value: "both" as Lang, label: t("langBoth") }] : []),
                ]}
              />
            </OptionCard>
          )}
          <OptionCard>
            <p className="text-[14px] text-fg-2">{t("cloudNote")}</p>
            <div className="mt-3">
              <CloudRemaining />
            </div>
          </OptionCard>
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

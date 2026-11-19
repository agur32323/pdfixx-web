"use client";

import dynamic from "next/dynamic";

import { toolById } from "@/lib/tools";

import { Spinner } from "./ui";

const loading = () => (
  <div className="grid min-h-[60dvh] place-items-center">
    <Spinner className="size-6" />
  </div>
);

// Each tool loads only its own code (pdf-lib, pdf.js, firebase…).
const SCREENS = {
  ai: dynamic(() => import("./ai/assistant"), { loading }),
  merge: dynamic(() => import("./tools/merge"), { loading }),
  split: dynamic(() => import("./tools/split"), { loading }),
  organize: dynamic(() => import("./tools/organize"), { loading }),
  rotate: dynamic(() => import("./tools/organize"), { loading }),
  compress: dynamic(() => import("./tools/compress"), { loading }),
  ocr: dynamic(() => import("./tools/cloud-convert"), { loading }),
  repair: dynamic(() => import("./tools/cloud-convert"), { loading }),
  scan: dynamic(() => import("./tools/images"), { loading }),
  imagepdf: dynamic(() => import("./tools/images"), { loading }),
  word_pdf: dynamic(() => import("./tools/cloud-convert"), { loading }),
  excel_pdf: dynamic(() => import("./tools/cloud-convert"), { loading }),
  ppt_pdf: dynamic(() => import("./tools/cloud-convert"), { loading }),
  pdf_image: dynamic(() => import("./tools/pdf-to-image"), { loading }),
  pdf_word: dynamic(() => import("./tools/cloud-convert"), { loading }),
  pdf_excel: dynamic(() => import("./tools/cloud-convert"), { loading }),
  pdf_ppt: dynamic(() => import("./tools/cloud-convert"), { loading }),
  annotate: dynamic(() => import("./tools/annotate"), { loading }),
  sign: dynamic(() => import("./tools/sign"), { loading }),
  watermark: dynamic(() => import("./tools/watermark"), { loading }),
  page_numbers: dynamic(() => import("./tools/page-numbers"), { loading }),
  protect: dynamic(() => import("./tools/security").then((m) => m.ProtectTool), { loading }),
  unlock: dynamic(() => import("./tools/security").then((m) => m.UnlockTool), { loading }),
} as const;

export function ToolScreen({ id }: { id: keyof typeof SCREENS }) {
  const Screen = SCREENS[id];
  return <Screen tool={toolById(id)!} />;
}

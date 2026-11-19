import {
  Combine,
  FileImage,
  FileSpreadsheet,
  FileText,
  Hash,
  Images,
  LayoutGrid,
  Lock,
  LockOpen,
  type LucideIcon,
  PenLine,
  Presentation,
  RotateCw,
  ScanLine,
  ScanText,
  Shrink,
  Signature,
  Sparkles,
  Split,
  Stamp,
  Table2,
  Wrench,
  FileType,
  MonitorPlay,
} from "lucide-react";

import type { StringKey } from "./i18n/strings";

export type Category = "ai" | "organize" | "optimize" | "convertTo" | "convertFrom" | "edit" | "security";

export type ToolDef = {
  id: string;
  /** URL path, e.g. /merge-pdf. */
  slug: string;
  category: Category;
  icon: LucideIcon;
  title: StringKey;
  sub: StringKey;
  /** Sends the file to a conversion server instead of working in the browser. */
  cloud?: boolean;
  /** File types the tool takes. */
  accept: string;
};

const PDF = "application/pdf,.pdf";
const IMAGES = "image/*";

// Same order and grouping as the app (lib/ui/tools/tools.dart).
export const TOOLS: ToolDef[] = [
  { id: "ai", slug: "ai-pdf-assistant", category: "ai", icon: Sparkles, title: "toolAi", sub: "toolAiSub", cloud: true, accept: PDF },

  { id: "merge", slug: "merge-pdf", category: "organize", icon: Combine, title: "toolMerge", sub: "toolMergeSub", accept: PDF },
  { id: "split", slug: "split-pdf", category: "organize", icon: Split, title: "toolSplit", sub: "toolSplitSub", accept: PDF },
  { id: "organize", slug: "organize-pdf", category: "organize", icon: LayoutGrid, title: "toolOrganize", sub: "toolOrganizeSub", accept: PDF },
  { id: "rotate", slug: "rotate-pdf", category: "organize", icon: RotateCw, title: "toolRotate", sub: "toolRotateSub", accept: PDF },

  { id: "compress", slug: "compress-pdf", category: "optimize", icon: Shrink, title: "toolCompress", sub: "toolCompressSub", accept: PDF },
  { id: "ocr", slug: "ocr-pdf", category: "optimize", icon: ScanText, title: "toolOcr", sub: "toolOcrSub", cloud: true, accept: PDF },
  { id: "repair", slug: "repair-pdf", category: "optimize", icon: Wrench, title: "toolRepair", sub: "toolRepairSub", cloud: true, accept: PDF },

  { id: "scan", slug: "scan-to-pdf", category: "convertTo", icon: ScanLine, title: "toolScan", sub: "toolScanSub", accept: IMAGES },
  { id: "imagepdf", slug: "jpg-to-pdf", category: "convertTo", icon: FileImage, title: "toolImageToPdf", sub: "toolImageToPdfSub", accept: IMAGES },
  {
    id: "word_pdf",
    slug: "word-to-pdf",
    category: "convertTo",
    icon: FileText,
    title: "toolWordToPdf",
    sub: "toolWordToPdfSub",
    cloud: true,
    accept: ".doc,.docx,.odt,.rtf",
  },
  {
    id: "excel_pdf",
    slug: "excel-to-pdf",
    category: "convertTo",
    icon: Table2,
    title: "toolExcelToPdf",
    sub: "toolExcelToPdfSub",
    cloud: true,
    accept: ".xls,.xlsx,.ods",
  },
  {
    id: "ppt_pdf",
    slug: "powerpoint-to-pdf",
    category: "convertTo",
    icon: Presentation,
    title: "toolPptToPdf",
    sub: "toolPptToPdfSub",
    cloud: true,
    accept: ".ppt,.pptx,.odp",
  },

  { id: "pdf_image", slug: "pdf-to-jpg", category: "convertFrom", icon: Images, title: "toolPdfToImage", sub: "toolPdfToImageSub", accept: PDF },
  { id: "pdf_word", slug: "pdf-to-word", category: "convertFrom", icon: FileType, title: "toolPdfToWord", sub: "toolPdfToWordSub", cloud: true, accept: PDF },
  {
    id: "pdf_excel",
    slug: "pdf-to-excel",
    category: "convertFrom",
    icon: FileSpreadsheet,
    title: "toolPdfToExcel",
    sub: "toolPdfToExcelSub",
    cloud: true,
    accept: PDF,
  },
  { id: "pdf_ppt", slug: "pdf-to-powerpoint", category: "convertFrom", icon: MonitorPlay, title: "toolPdfToPpt", sub: "toolPdfToPptSub", cloud: true, accept: PDF },

  { id: "annotate", slug: "edit-pdf", category: "edit", icon: PenLine, title: "toolAnnotate", sub: "toolAnnotateSub", accept: PDF },
  { id: "sign", slug: "sign-pdf", category: "edit", icon: Signature, title: "toolSign", sub: "toolSignSub", accept: PDF },
  { id: "watermark", slug: "watermark-pdf", category: "edit", icon: Stamp, title: "toolWatermark", sub: "toolWatermarkSub", accept: PDF },
  { id: "page_numbers", slug: "add-page-numbers", category: "edit", icon: Hash, title: "toolPageNumbers", sub: "toolPageNumbersSub", accept: PDF },

  { id: "protect", slug: "protect-pdf", category: "security", icon: Lock, title: "toolProtect", sub: "toolProtectSub", accept: PDF },
  { id: "unlock", slug: "unlock-pdf", category: "security", icon: LockOpen, title: "toolUnlock", sub: "toolUnlockSub", accept: PDF },
];

export const CATEGORIES: { id: Category; title: StringKey; color: string }[] = [
  { id: "organize", title: "catOrganize", color: "var(--organize)" },
  { id: "optimize", title: "catOptimize", color: "var(--optimize)" },
  { id: "convertTo", title: "catConvertTo", color: "var(--to-pdf)" },
  { id: "convertFrom", title: "catConvertFrom", color: "var(--from-pdf)" },
  { id: "edit", title: "catEdit", color: "var(--edit)" },
  { id: "security", title: "catSecurity", color: "var(--security)" },
];

export const categoryColor = (c: Category) => (c === "ai" ? "var(--ai)" : CATEGORIES.find((x) => x.id === c)!.color);

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);
export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
export const toolHref = (t: ToolDef | string) => `/${typeof t === "string" ? toolById(t)!.slug : t.slug}`;

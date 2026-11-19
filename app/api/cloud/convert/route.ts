import { json, rateLimited, sameSite } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CAD = ["dwg", "dxf", "dwf"].flatMap((f) => ["pdf", "png", "jpg", "svg"].map((t) => `${f}/to/${t}`));
const ENDPOINTS = new Set(["pdf/to/docx", "pdf/to/xlsx", "pdf/to/pptx", ...CAD]);

/** Options the site may pass through to ConvertAPI, with the values it allows. */
const OPTIONS: Record<string, (v: unknown) => boolean> = {
  SpaceToConvert: (v) => v === "default" || v === "all" || v === "model",
  PageSize: (v) => typeof v === "string" && /^(default|a[0-4]|letter|legal|ledger)$/.test(v),
  PageOrientation: (v) => v === "portrait" || v === "landscape",
  ColorSpace: (v) => v === "truecolors" || v === "grayscale" || v === "monochrome",
  ExportLayers: (v) => typeof v === "boolean",
  AutoFit: (v) => typeof v === "boolean",
  ImageResolution: (v) => typeof v === "number" && v >= 72 && v <= 600,
};

/**
 * Converts a file the browser already uploaded to ConvertAPI (by its id).
 * The secret stays here; the browser gets back download URLs.
 */
export async function POST(req: Request) {
  if (!sameSite(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(req)) return json({ error: "rate_limited" }, 429);
  const secret = process.env.CONVERTAPI_SECRET;
  if (!secret) return json({ error: "not_configured" }, 503);

  const body = (await req.json().catch(() => ({}))) as {
    endpoint?: string;
    fileId?: string;
    password?: string;
    ocrLanguage?: string;
    options?: Record<string, unknown>;
  };
  if (!body.endpoint || !ENDPOINTS.has(body.endpoint)) return json({ error: "unknown_tool" }, 400);
  if (!body.fileId || !/^[\w-]{8,64}$/.test(body.fileId)) return json({ error: "bad_file" }, 400);
  const fromPdf = body.endpoint.startsWith("pdf/");

  const convert = (ocr: "auto" | "force") => {
    const params: { Name: string; Value?: unknown; FileValue?: { Id: string } }[] = [
      { Name: "File", FileValue: { Id: body.fileId! } },
      { Name: "StoreFile", Value: true },
      { Name: "Timeout", Value: 280 },
    ];
    if (fromPdf) {
      params.push({ Name: "OcrMode", Value: ocr }, { Name: "OcrLanguage", Value: body.ocrLanguage === "tr" ? "tr" : "en" });
      if (body.password) params.push({ Name: "Password", Value: body.password });
    }
    for (const [k, v] of Object.entries(body.options ?? {})) if (OPTIONS[k]?.(v)) params.push({ Name: k, Value: v });
    // The token goes in the header (ConvertAPI's recommended way), not in the URL.
    return fetch(`https://v2.convertapi.com/convert/${body.endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ Parameters: params }),
      cache: "no-store",
    });
  };

  let res = await convert("auto");
  // Scanned PDFs sometimes fail the automatic mode; retry forcing OCR (as the app does).
  if (res.status === 500 && fromPdf) res = await convert("force");
  if (!res.ok) {
    const status = res.status;
    // 401: bad token. 403: no conversions left on the plan.
    const error = status === 401 ? "key" : status === 402 || status === 403 || status === 429 ? "quota" : status === 400 || status === 415 ? "unsupported" : "server";
    return json({ error }, 502);
  }
  const data = (await res.json()) as { Files?: { FileName: string; Url: string }[] };
  const files = (data.Files ?? []).filter((f) => f.Url).map((f) => ({ url: f.Url, fileName: f.FileName }));
  if (!files.length) return json({ error: "unsupported" }, 502);
  return json({ url: files[0].url, fileName: files[0].fileName, files });
}

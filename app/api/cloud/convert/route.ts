import { json, rateLimited, sameSite } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ENDPOINTS = new Set(["pdf/to/docx", "pdf/to/xlsx", "pdf/to/pptx"]);

/**
 * Converts a file the browser already uploaded to ConvertAPI (by its id).
 * The secret stays here; the browser gets back a download URL.
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
  };
  if (!body.endpoint || !ENDPOINTS.has(body.endpoint)) return json({ error: "unknown_tool" }, 400);
  if (!body.fileId || !/^[\w-]{8,64}$/.test(body.fileId)) return json({ error: "bad_file" }, 400);

  const convert = (ocr: "auto" | "force") => {
    const params: { Name: string; Value?: unknown; FileValue?: { Id: string } }[] = [
      { Name: "File", FileValue: { Id: body.fileId! } },
      { Name: "StoreFile", Value: true },
      { Name: "Timeout", Value: 280 },
      { Name: "OcrMode", Value: ocr },
      { Name: "OcrLanguage", Value: body.ocrLanguage === "tr" ? "tr" : "en" },
    ];
    if (body.password) params.push({ Name: "Password", Value: body.password });
    return fetch(`https://v2.convertapi.com/convert/${body.endpoint}?Secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Parameters: params }),
      cache: "no-store",
    });
  };

  let res = await convert("auto");
  // Scanned PDFs sometimes fail the automatic mode; retry forcing OCR (as the app does).
  if (res.status === 500) res = await convert("force");
  if (!res.ok) {
    const status = res.status;
    const error = status === 401 || status === 403 ? "key" : status === 402 || status === 429 ? "quota" : status === 400 || status === 415 ? "unsupported" : "server";
    return json({ error }, 502);
  }
  const data = (await res.json()) as { Files?: { FileName: string; Url: string }[] };
  const file = data.Files?.[0];
  if (!file?.Url) return json({ error: "unsupported" }, 502);
  return json({ url: file.Url, fileName: file.FileName });
}

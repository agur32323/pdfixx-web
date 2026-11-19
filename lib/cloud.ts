"use client";

/**
 * Cloud conversions, as in the app: iLovePDF for Office → PDF, OCR, repair and
 * cloud compression; ConvertAPI for PDF → Office. Files are uploaded straight
 * from the browser to the service; our server only starts the task.
 */
export type CloudErrorCode = "noInternet" | "quota" | "key" | "notConfigured" | "tooLarge" | "unsupported" | "server" | "cancelled";

export class CloudError extends Error {
  constructor(public code: CloudErrorCode) {
    super(code);
  }
}

export type CloudStage = "connect" | "upload" | "process" | "download";

export type CloudCallbacks = {
  onStage?: (stage: CloudStage) => void;
  /** Overall progress 0–1. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

function mapServerError(code: string | undefined): CloudError {
  switch (code) {
    case "not_configured":
      return new CloudError("notConfigured");
    case "quota":
    case "rate_limited":
      return new CloudError("quota");
    case "key":
      return new CloudError("key");
    case "unsupported":
    case "bad_file":
      return new CloudError("unsupported");
    default:
      return new CloudError("server");
  }
}

async function call<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw signal?.aborted ? new CloudError("cancelled") : new CloudError("noInternet");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw mapServerError(data.error);
  return data;
}

/** POSTs with upload progress (fetch can't report it). */
function upload(
  url: string,
  body: XMLHttpRequestBodyInit,
  opts: { headers?: Record<string, string>; onProgress?: (f: number) => void; signal?: AbortSignal },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(opts.headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new CloudError(xhr.status === 413 ? "tooLarge" : xhr.status === 401 ? "key" : xhr.status === 400 ? "unsupported" : "server"));
    };
    xhr.onerror = () => reject(new CloudError("noInternet"));
    xhr.onabort = () => reject(new CloudError("cancelled"));
    opts.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}

async function download(url: string, init: RequestInit, onProgress?: (f: number) => void): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw init.signal?.aborted ? new CloudError("cancelled") : new CloudError("noInternet");
  }
  if (!res.ok) throw new CloudError("server");
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !total) return res.blob();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(got / total);
  }
  return new Blob(chunks as BlobPart[], { type: res.headers.get("content-type") ?? "application/octet-stream" });
}

export async function ilovepdf(
  o: { tool: "officepdf" | "pdfocr" | "repair" | "compress"; file: File; password?: string; params?: Record<string, unknown> } & CloudCallbacks,
): Promise<Blob> {
  o.onStage?.("connect");
  const { token, server, task } = await call<{ token: string; server: string; task: string }>("/api/cloud/ilovepdf", { tool: o.tool }, o.signal);
  const auth = { Authorization: `Bearer ${token}` };

  o.onStage?.("upload");
  const form = new FormData();
  form.append("task", task);
  form.append("file", o.file, o.file.name);
  const up = JSON.parse(
    await upload(`https://${server}/v1/upload`, form, { headers: auth, onProgress: (f) => o.onProgress?.(f * 0.6), signal: o.signal }),
  ) as { server_filename: string };

  o.onStage?.("process");
  o.onProgress?.(0.6);
  let res: Response;
  try {
    res = await fetch(`https://${server}/v1/process`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        tool: o.tool,
        files: [{ server_filename: up.server_filename, filename: o.file.name, ...(o.password ? { password: o.password } : {}) }],
        ...o.params,
      }),
      signal: o.signal,
    });
  } catch {
    throw o.signal?.aborted ? new CloudError("cancelled") : new CloudError("noInternet");
  }
  if (!res.ok) throw new CloudError(res.status === 400 ? "unsupported" : res.status === 401 ? "key" : "server");

  o.onStage?.("download");
  o.onProgress?.(0.8);
  return download(`https://${server}/v1/download/${task}`, { headers: auth, signal: o.signal }, (f) => o.onProgress?.(0.8 + f * 0.2));
}

export async function convertApi(
  o: { endpoint: "pdf/to/docx" | "pdf/to/xlsx" | "pdf/to/pptx"; file: File; password?: string; ocrLanguage?: "tr" | "en" } & CloudCallbacks,
): Promise<Blob> {
  o.onStage?.("upload");
  const up = JSON.parse(
    await upload(`https://v2.convertapi.com/upload?filename=${encodeURIComponent(o.file.name)}`, o.file, {
      onProgress: (f) => o.onProgress?.(f * 0.6),
      signal: o.signal,
    }),
  ) as { FileId: string };

  o.onStage?.("process");
  o.onProgress?.(0.6);
  const { url } = await call<{ url: string }>(
    "/api/cloud/convert",
    { endpoint: o.endpoint, fileId: up.FileId, password: o.password, ocrLanguage: o.ocrLanguage },
    o.signal,
  );

  o.onStage?.("download");
  o.onProgress?.(0.85);
  return download(url, { signal: o.signal }, (f) => o.onProgress?.(0.85 + f * 0.15));
}

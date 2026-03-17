// app/api/ilovepdf/merge/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type UploadedFile = {
  server_filename: string;
  filename: string;
};

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function getToken() {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  if (!publicKey) throw new Error("ILOVEPDF_PUBLIC_KEY eksik");

  const authRes = await fetch("https://api.ilovepdf.com/v1/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: publicKey }),
    cache: "no-store",
  });

  const authData = await safeJson(authRes);
  if (!authRes.ok) throw new Error(authData?.error || authData?.message || `Auth hatası (${authRes.status})`);
  if (!authData?.token) throw new Error("Token alınamadı");

  return authData.token as string;
}

async function startMergeTask(token: string) {
  const taskRes = await fetch("https://api.ilovepdf.com/v1/start/merge", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const taskData = await safeJson(taskRes);
  if (!taskRes.ok) throw new Error(taskData?.error || taskData?.message || `Task başlatılamadı (${taskRes.status})`);
  if (!taskData?.server || !taskData?.task) throw new Error("Task bilgisi eksik");

  return { server: taskData.server as string, task: taskData.task as string };
}

async function uploadFiles(
  files: File[],
  task: string,
  server: string,
  token: string
): Promise<UploadedFile[]> {
  const uploadedFiles: UploadedFile[] = [];

  for (const file of files) {
    const uploadForm = new FormData();
    uploadForm.append("task", task);
    uploadForm.append("file", file, file.name);

    const uploadRes = await fetch(`https://${server}/v1/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm,
    });

    const uploadData = await safeJson(uploadRes);
    if (!uploadRes.ok) throw new Error(uploadData?.error || uploadData?.message || `"${file.name}" yüklenemedi (${uploadRes.status})`);
    if (!uploadData?.server_filename) throw new Error(`"${file.name}" için server_filename alınamadı`);

    uploadedFiles.push({
      server_filename: uploadData.server_filename,
      filename: file.name,
    });
  }

  return uploadedFiles;
}

async function processMerge(
  uploadedFiles: UploadedFile[],
  task: string,
  server: string,
  token: string
) {
  const filesPayload = uploadedFiles.map((f) => ({
    server_filename: f.server_filename,
    filename: f.filename,
    rotate: 0,
    password: "",
    ranges: "",
  }));

  const processRes = await fetch(`https://${server}/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task,
      tool: "merge",
      files: filesPayload,
    }),
  });

  const processData = await safeJson(processRes);
  if (!processRes.ok) {
    const detail = processData?.error || processData?.message || JSON.stringify(processData) || `İşlem hatası (${processRes.status})`;
    throw new Error(detail);
  }
}

async function downloadMergedFile(task: string, server: string, token: string) {
  const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!downloadRes.ok) {
    let msg = `İndirme hatası (${downloadRes.status})`;
    try { const t = await downloadRes.text(); if (t) msg = t; } catch {}
    throw new Error(msg);
  }

  return await downloadRes.arrayBuffer();
}

// -------------------------------------------------------
// GET — Sadece token + task döndürür (dosya geçmez)
// Büyük dosyalar için client-side upload akışında kullanılır
// -------------------------------------------------------
export async function GET() {
  try {
    const token = await getToken();
    const { server, task } = await startMergeTask(token);

    return NextResponse.json({ token, task, server });
  } catch (e: any) {
    console.error("[merge/GET]", e);
    return NextResponse.json({ error: e?.message ?? "Bilinmeyen hata" }, { status: 500 });
  }
}

// -------------------------------------------------------
// POST — Eskiden kullanılan küçük dosya akışı (4.5 MB altı)
// Büyük dosyalarda 413 verir, o durumda client GET akışına geçer
// -------------------------------------------------------
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];

    if (!files || files.length < 2) {
      return NextResponse.json({ error: "En az 2 PDF seçmelisin." }, { status: 400 });
    }

    const token = await getToken();
    const { server, task } = await startMergeTask(token);
    const uploadedFiles = await uploadFiles(files, task, server, token);
    await processMerge(uploadedFiles, task, server, token);
    const pdfArrayBuffer = await downloadMergedFile(task, server, token);

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pdfixx_merged_${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[merge/POST]", e);
    return NextResponse.json({ error: e?.message ?? "Bilinmeyen hata" }, { status: 500 });
  }
}
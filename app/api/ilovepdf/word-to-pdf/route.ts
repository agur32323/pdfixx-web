import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ILOVE_BASE = "https://api.ilovepdf.com/v1";

async function getToken(req: Request) {
  const authUrl = new URL("/api/ilovepdf/auth", req.url); // ✅ Vercel'de doğru domain
  const res = await fetch(authUrl, {
    method: "POST",
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Auth token alınamadı");
  const data = await res.json();
  if (!data?.token) throw new Error("Token boş geldi");
  return data.token as string;
}

export async function POST(req: Request) {
  try {
    const token = await getToken(req);
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Dosya gönderilmedi" }, { status: 400 });
    }

    // ✅ 1) start officepdf
    const startRes = await fetch(`${ILOVE_BASE}/start/officepdf`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!startRes.ok) throw new Error(await startRes.text());

    const start = await startRes.json();
    const server = start.server as string;
    const task = start.task as string;

    // ✅ 2) upload
    const uploadFd = new FormData();
    uploadFd.append("task", task);
    uploadFd.append("file", file, file.name);

    const uploadRes = await fetch(`https://${server}/v1/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadFd,
    });
    if (!uploadRes.ok) throw new Error(await uploadRes.text());

    const up = await uploadRes.json();
    const serverFilename = up.server_filename as string;

    // ✅ 3) process officepdf
    const processBody = {
      task,
      tool: "officepdf",
      files: [{ server_filename: serverFilename, filename: file.name }],
    };

    const processRes = await fetch(`https://${server}/v1/process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(processBody),
    });
    if (!processRes.ok) throw new Error(await processRes.text());

    // ✅ 4) download PDF
    const dlRes = await fetch(`https://${server}/v1/download/${task}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!dlRes.ok) throw new Error(await dlRes.text());

    const bytes = await dlRes.arrayBuffer();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="word_to_pdf_${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "word-to-pdf error" },
      { status: 500 }
    );
  }
}
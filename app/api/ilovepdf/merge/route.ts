import { NextResponse } from "next/server";

export const runtime = "nodejs"; // PDF bytes için şart

async function getToken() {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  if (!publicKey) throw new Error("ILOVEPDF_PUBLIC_KEY missing");

  const authRes = await fetch("https://api.ilovepdf.com/v1/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: publicKey }),
  });

  const authData = await authRes.json();
  if (!authRes.ok) throw new Error(authData?.error || "Auth failed");
  if (!authData?.token) throw new Error("Token missing");
  return authData.token as string;
}

async function startMergeTask(token: string) {
  const taskRes = await fetch("https://api.ilovepdf.com/v1/start/merge", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const taskData = await taskRes.json();
  if (!taskRes.ok) throw new Error(taskData?.error || "Start task failed");
  if (!taskData?.server || !taskData?.task) throw new Error("Task info missing");

  return { server: taskData.server as string, task: taskData.task as string };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];

    if (!files || files.length < 2) {
      return NextResponse.json(
        { error: "En az 2 PDF seçmelisin." },
        { status: 400 }
      );
    }

    const token = await getToken();
    const { server, task } = await startMergeTask(token);

    // 1) Upload
    const uploadedFiles: Array<{ server_filename: string; filename: string }> = [];

    for (const f of files) {
      const upForm = new FormData();
      upForm.append("task", task);
      upForm.append("file", f, f.name);

      const upRes = await fetch(`https://${server}/v1/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: upForm,
      });

      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData?.error || "Upload failed");

      uploadedFiles.push({
        server_filename: upData.server_filename,
        filename: f.name,
      });
    }

    // 2) Process merge
    const processRes = await fetch(`https://${server}/v1/process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task,
        tool: "merge",
        files: uploadedFiles,
      }),
    });

    const processData = await processRes.json();
    if (!processRes.ok) throw new Error(processData?.error || "Process failed");

    // 3) Download result PDF
    const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!downloadRes.ok) {
      const txt = await downloadRes.text().catch(() => "");
      throw new Error(txt || "Download failed");
    }

    const pdfArrayBuffer = await downloadRes.arrayBuffer();
    const fileName = `pdfixx_merged_${Date.now()}.pdf`;

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

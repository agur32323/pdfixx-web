import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function getToken() {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  if (!publicKey) throw new Error("ILOVEPDF_PUBLIC_KEY missing");

  const authRes = await fetch("https://api.ilovepdf.com/v1/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: publicKey }),
    cache: "no-store",
  });

  const authData = await authRes.json();

  if (!authRes.ok) {
    throw new Error(authData?.error || "Auth failed");
  }

  if (!authData?.token) {
    throw new Error("Token missing");
  }

  return authData.token as string;
}

async function startMergeTask(token: string) {
  const taskRes = await fetch("https://api.ilovepdf.com/v1/start/merge", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const taskData = await taskRes.json();

  if (!taskRes.ok) {
    throw new Error(taskData?.error || "Start task failed");
  }

  if (!taskData?.server || !taskData?.task) {
    throw new Error("Task info missing");
  }

  return {
    server: taskData.server as string,
    task: taskData.task as string,
  };
}

function reorderFiles(files: File[], orderRaw: string | null): File[] {
  if (!orderRaw) return files;

  try {
    const order = JSON.parse(orderRaw);

    if (!Array.isArray(order)) return files;
    if (order.length !== files.length) return files;

    const isValid = order.every(
      (i) => Number.isInteger(i) && i >= 0 && i < files.length
    );

    if (!isValid) return files;

    const unique = new Set(order);
    if (unique.size !== files.length) return files;

    return order.map((index: number) => files[index]);
  } catch {
    return files;
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const rawFiles = form.getAll("files") as File[];
    const orderRaw = form.get("order")?.toString() ?? null;

    if (!rawFiles || rawFiles.length < 2) {
      return NextResponse.json(
        { error: "En az 2 PDF seçmelisin." },
        { status: 400 }
      );
    }

    // Frontend'den order geldiyse o sıraya göre diz
    const files = reorderFiles(rawFiles, orderRaw);

    const token = await getToken();
    const { server, task } = await startMergeTask(token);

    const uploadedFiles: Array<{
      server_filename: string;
      filename: string;
    }> = [];

    for (const file of files) {
      const uploadForm = new FormData();
      uploadForm.append("task", task);
      uploadForm.append("file", file, file.name);

      const uploadRes = await fetch(`https://${server}/v1/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadForm,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData?.error || "Upload failed");
      }

      uploadedFiles.push({
        server_filename: uploadData.server_filename,
        filename: file.name,
      });
    }

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

    if (!processRes.ok) {
      throw new Error(processData?.error || "Process failed");
    }

    const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
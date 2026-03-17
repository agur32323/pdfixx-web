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

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function getToken() {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error("ILOVEPDF_PUBLIC_KEY missing");
  }

  const authRes = await fetch("https://api.ilovepdf.com/v1/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: publicKey }),
    cache: "no-store",
  });

  const authData = await safeJson(authRes);

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
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const taskData = await safeJson(taskRes);

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
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: uploadForm,
    });

    const uploadData = await safeJson(uploadRes);
    const uploadText = await safeText(uploadRes.clone());

    if (!uploadRes.ok) {
      throw new Error(
        uploadData?.error ||
          uploadData?.message ||
          uploadText ||
          "Upload failed"
      );
    }

    if (!uploadData?.server_filename) {
      throw new Error("Upload response missing server_filename");
    }

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
      packaged_filename: "pdfixx_merge_result",
      ignore_errors: false,
    }),
  });

  const processData = await safeJson(processRes);
  const processText = await safeText(processRes.clone());

  if (!processRes.ok) {
    throw new Error(
      processData?.error ||
        processData?.message ||
        processText ||
        "Process failed"
    );
  }

  return processData;
}

async function downloadMergedFile(task: string, server: string, token: string) {
  const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!downloadRes.ok) {
    const txt = await safeText(downloadRes);
    throw new Error(txt || "Download failed");
  }

  const contentType = downloadRes.headers.get("content-type") || "";

  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    const txt = await safeText(downloadRes.clone());
    throw new Error(txt || "Downloaded file is not a PDF");
  }

  return downloadRes.arrayBuffer();
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

    const files = reorderFiles(rawFiles, orderRaw);

    const token = await getToken();
    const { server, task } = await startMergeTask(token);

    const uploadedFiles = await uploadFiles(files, task, server, token);
    await processMerge(uploadedFiles, task, server, token);
    const pdfArrayBuffer = await downloadMergedFile(task, server, token);

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
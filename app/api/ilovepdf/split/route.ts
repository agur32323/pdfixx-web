import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ILOVE_BASE = "https://api.ilovepdf.com/v1";

async function getToken() {
  const res = await fetch("http://localhost:3000/api/ilovepdf/auth", {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Auth token alınamadı");
  const data = await res.json();
  if (!data?.token) throw new Error("Token boş geldi");
  return data.token as string;
}

/**
 * Kullanıcı inputunu iLovePDF'in beklediği formata çevir:
 * Örn: "1-3, 6 , 8-10" -> "1-3,6,8-10"
 * Örn: "1-3;6;8-10"   -> "1-3,6,8-10"
 */
function normalizeRanges(input: string) {
  let r = (input || "").trim();

  // ; gibi ayraçları virgüle çevir
  r = r.replace(/[;|]/g, ",");

  // boşlukları kaldır
  r = r.replace(/\s+/g, "");

  // birden fazla virgülü tek virgül yap
  r = r.replace(/,+/g, ",");

  // baş/son virgül varsa temizle
  r = r.replace(/^,|,$/g, "");

  return r;
}

/**
 * iLovePDF docs örneği: "1,5,10-14"  [oai_citation:2‡iLoveAPI - A PDF REST API for developers](https://developer.ilovepdf.com/docs)
 * Biz de "1-3,6,8-10" gibi formatları kabul ediyoruz.
 */
function isValidRanges(r: string) {
  // Parçalar: "12" veya "12-34"
  // Hepsi virgülle ayrılır.
  return /^(\d+(-\d+)?)(,(\d+(-\d+)?))*$/.test(r);
}

export async function POST(req: Request) {
  try {
    const token = await getToken();

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const rangeRaw = (form.get("range")?.toString() ?? "").trim();
    const ranges = normalizeRanges(rangeRaw);

    if (!file) {
      return NextResponse.json({ error: "PDF dosyası gönderilmedi" }, { status: 400 });
    }
    if (!ranges) {
      return NextResponse.json({ error: "Sayfa aralığı boş" }, { status: 400 });
    }
    if (!isValidRanges(ranges)) {
      return NextResponse.json(
        { error: "Sayfa aralığı formatı hatalı. Örn: 1-3,6,8-10" },
        { status: 400 }
      );
    }

    // 1) Start split task
    const startRes = await fetch(`${ILOVE_BASE}/start/split`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!startRes.ok) {
      const t = await startRes.text();
      throw new Error(`start/split başarısız: ${t}`);
    }

    const start = await startRes.json();
    const server = start.server as string;
    const task = start.task as string;

    // 2) Upload
    const uploadFd = new FormData();
    uploadFd.append("task", task);
    uploadFd.append("file", file, file.name);

    const uploadRes = await fetch(`https://${server}/v1/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadFd,
    });

    if (!uploadRes.ok) {
      const t = await uploadRes.text();
      throw new Error(`upload başarısız: ${t}`);
    }

    const up = await uploadRes.json();
    const serverFilename = up.server_filename as string;

    // 3) Process
    // split_mode=ranges ve ranges="1,5,10-14" formatı docs'ta bu şekilde  [oai_citation:3‡iLoveAPI - A PDF REST API for developers](https://developer.ilovepdf.com/docs)
    const processBody = {
      task,
      tool: "split",
      files: [{ server_filename: serverFilename, filename: file.name }],
      split_mode: "ranges",
      ranges,            // ✅ normalize edilmiş tek string
      merge_after: false // ✅ çoklu range -> ZIP beklenir
    };

    const processRes = await fetch(`https://${server}/v1/process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(processBody),
    });

    if (!processRes.ok) {
      const t = await processRes.text();
      throw new Error(`process başarısız: ${t}`);
    }

    // 4) Download (PDF veya ZIP gelebilir)
    const dlRes = await fetch(`https://${server}/v1/download/${task}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!dlRes.ok) {
      const t = await dlRes.text();
      throw new Error(`download başarısız: ${t}`);
    }

    const contentType = dlRes.headers.get("content-type") || "application/octet-stream";
    const bytes = await dlRes.arrayBuffer();

    const isZip = contentType.includes("zip");
    const filename = isZip ? `split_${Date.now()}.zip` : `split_${Date.now()}.pdf`;

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Split error" }, { status: 500 });
  }
}
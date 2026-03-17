"use client";

import Link from "next/link";
import React, { useMemo, useRef, useState } from "react";

type Tool = "merge" | "split" | "wordToPdf";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [activeTool, setActiveTool] = useState<Tool>("merge");
  const [splitRange, setSplitRange] = useState<string>("1-3");
  const [dragActive, setDragActive] = useState<boolean>(false);

  const accept = useMemo(() => {
    if (activeTool === "wordToPdf") {
      return ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    return "application/pdf,.pdf";
  }, [activeTool]);

  const primaryLabel =
    activeTool === "merge" ? "Birleştir" : activeTool === "split" ? "PDF Böl" : "Word → PDF";

  const helperText =
    activeTool === "merge"
      ? "Birden fazla PDF seç. Aşağıdaki listeden sıralamayı değiştirebilirsin."
      : activeTool === "split"
      ? "Tek PDF seç, aralığı gir."
      : "Tek Word dosyası seç (.doc/.docx).";

  const toolMeta = useMemo(() => {
    if (activeTool === "merge") {
      return {
        title: "PDF Birleştir",
        desc: "Birden fazla PDF’i tek dosyada birleştir.",
        accent: "from-red-500 to-red-600",
        ring: "focus:ring-red-200",
      };
    }

    if (activeTool === "split") {
      return {
        title: "PDF Böl",
        desc: "Tek PDF’i sayfa aralığına göre böl.",
        accent: "from-blue-500 to-blue-600",
        ring: "focus:ring-blue-200",
      };
    }

    return {
      title: "Word → PDF",
      desc: "Word belgesini hızlıca PDF’e çevir.",
      accent: "from-emerald-500 to-emerald-600",
      ring: "focus:ring-emerald-200",
    };
  }, [activeTool]);

  const pick = () => inputRef.current?.click();

  const clearFiles = () => {
    setFiles([]);
    setStatus("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const changeTool = (t: Tool) => {
    setActiveTool(t);
    clearFiles();
    setStatus("");
  };

  const filterByTool = (list: File[]) => {
    if (activeTool === "wordToPdf") {
      return list.filter((f) => /\.(docx?|DOCX?)$/.test(f.name));
    }
    return list.filter((f) => /\.(pdf|PDF)$/.test(f.name));
  };

  const setPickedFiles = (list: File[]) => {
    const filtered = filterByTool(list);
    const finalList = filtered.length ? filtered : list;
    const normalized = activeTool === "merge" ? finalList : finalList.slice(0, 1);
    setFiles(normalized);
    setStatus("");
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    setPickedFiles(list);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const list = Array.from(e.dataTransfer.files ?? []);
    if (!list.length) return;
    setPickedFiles(list);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const moveFileUp = (index: number) => {
    if (index === 0) return;

    const updated = [...files];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setFiles(updated);
  };

  const moveFileDown = (index: number) => {
    if (index === files.length - 1) return;

    const updated = [...files];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setFiles(updated);
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const merge = async () => {
    if (files.length < 2) {
      setStatus("En az 2 PDF seçmelisin.");
      return;
    }

    setLoading(true);
    setStatus("PDF’ler birleştiriliyor...");

    try {
      const fd = new FormData();

      files.forEach((f) => {
        fd.append("files", f, f.name);
      });

      // Backend order bekliyorsa gönder
      fd.append("order", JSON.stringify(files.map((_, i) => i)));

      const res = await fetch("/api/ilovepdf/merge", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Birleştirme başarısız");
      }

      const blob = await res.blob();
      downloadBlob(blob, `merged_${Date.now()}.pdf`);
      setStatus("Tamamlandı ✅ PDF indirildi.");
    } catch (e: any) {
      setStatus(`Hata: ${e?.message ?? "Bilinmeyen hata"}`);
    } finally {
      setLoading(false);
    }
  };

  const split = async () => {
    if (!files[0]) {
      setStatus("Lütfen bir PDF seç.");
      return;
    }

    const r = splitRange.trim();
    if (!r) {
      setStatus("Lütfen sayfa aralığı gir (örn: 1-3,6,8-10).");
      return;
    }

    setLoading(true);
    setStatus("PDF bölünüyor...");

    try {
      const fd = new FormData();
      fd.append("file", files[0], files[0].name);
      fd.append("range", r);

      const res = await fetch("/api/ilovepdf/split", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Bölme başarısız");
      }

      const blob = await res.blob();
      const ct = res.headers.get("content-type") || "";
      const ext = ct.includes("zip") ? "zip" : "pdf";

      downloadBlob(blob, `split_${Date.now()}.${ext}`);
      setStatus(ext === "zip" ? "Tamamlandı ✅ ZIP indirildi." : "Tamamlandı ✅ PDF indirildi.");
    } catch (e: any) {
      setStatus(`Hata: ${e?.message ?? "Bilinmeyen hata"}`);
    } finally {
      setLoading(false);
    }
  };

  const wordToPdf = async () => {
    if (!files[0]) {
      setStatus("Lütfen bir Word dosyası seç (.doc/.docx).");
      return;
    }

    const name = files[0].name.toLowerCase();
    if (!name.endsWith(".docx") && !name.endsWith(".doc")) {
      setStatus("Word → PDF için .doc/.docx seçmelisin.");
      return;
    }

    setLoading(true);
    setStatus("Word → PDF dönüştürülüyor...");

    try {
      const fd = new FormData();
      fd.append("file", files[0], files[0].name);

      const res = await fetch("/api/ilovepdf/word-to-pdf", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Dönüştürme başarısız");
      }

      const blob = await res.blob();
      downloadBlob(blob, `word_to_pdf_${Date.now()}.pdf`);
      setStatus("Tamamlandı ✅ PDF indirildi.");
    } catch (e: any) {
      setStatus(`Hata: ${e?.message ?? "Bilinmeyen hata"}`);
    } finally {
      setLoading(false);
    }
  };

  const runActive = async () => {
    if (activeTool === "merge") return merge();
    if (activeTool === "split") return split();
    return wordToPdf();
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(0,0,0,0.06),transparent_45%),radial-gradient(900px_circle_at_80%_10%,rgba(0,0,0,0.05),transparent_40%)] bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <img src="/logo.png" alt="PDFixx Logo" className="h-full w-full object-cover" />
            </div>

            <div>
              <div className="text-lg font-extrabold tracking-tight text-zinc-900">PDFixx</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                PDF araçları • Hızlı çıktı • Kalıcı depolama yok
              </div>
            </div>
          </div>

          <a
            href="https://apps.apple.com/us/app/pdfixx/id6759792522"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            iOS Uygulamasını Yükle
            <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Secure processing • Fast export
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
              <span>⚡ Fast processing</span>
              <span>🔒 Secure processing</span>
              <span>📱 Available on iOS</span>
            </div>

            <h1 className="mt-5 bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">
              PDF işlemlerini saniyeler içinde yap.
            </h1>

            <p className="mt-4 leading-relaxed text-zinc-600">
              Dosyanı yükle, aracı seç, çıktıyı indir. Temiz ve hızlı bir deneyim.
            </p>

            <div className="mt-7 inline-flex rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
              <button
                onClick={() => changeTool("merge")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTool === "merge"
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
                disabled={loading}
              >
                PDF Birleştir
              </button>
              <button
                onClick={() => changeTool("split")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTool === "split"
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
                disabled={loading}
              >
                PDF Böl
              </button>
              <button
                onClick={() => changeTool("wordToPdf")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTool === "wordToPdf"
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
                disabled={loading}
              >
                Word → PDF
              </button>
            </div>

            <p className="mt-3 text-sm text-zinc-500">{helperText}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-zinc-900">Gizlilik</div>
                <div className="mt-1 text-xs text-zinc-500">Kalıcı depolama yapmayız.</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-zinc-900">Performans</div>
                <div className="mt-1 text-xs text-zinc-500">Hızlı işleme & indirme.</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-zinc-900">Basitlik</div>
                <div className="mt-1 text-xs text-zinc-500">Yükle → seç → indir.</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div
              className={`pointer-events-none absolute -inset-1 rounded-[28px] bg-gradient-to-r ${toolMeta.accent} opacity-20 blur-xl`}
            />
            <div className="relative rounded-[28px] border border-zinc-200 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{toolMeta.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">{toolMeta.desc}</div>
                </div>

                {files.length > 0 && (
                  <button
                    onClick={clearFiles}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    disabled={loading}
                  >
                    Temizle
                  </button>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple={activeTool === "merge"}
                className="hidden"
                onChange={onPick}
              />

              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                className={`mt-5 rounded-2xl border-2 border-dashed p-8 text-center transition ${
                  dragActive ? "border-zinc-400 bg-zinc-50" : "border-zinc-300 bg-zinc-50/60"
                }`}
              >
                <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 16V4m0 0 4 4M12 4 8 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-zinc-700"
                    />
                    <path
                      d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-zinc-700"
                    />
                  </svg>
                </div>

                <div className="text-sm font-semibold text-zinc-800">Dosyayı buraya sürükle</div>
                <div className="mt-1 text-xs text-zinc-500">veya</div>

                <button
                  onClick={pick}
                  className="mt-4 rounded-xl bg-gradient-to-r from-zinc-900 to-zinc-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                  disabled={loading}
                >
                  Dosya Seç
                </button>

                <div className="mt-3 text-xs text-zinc-500">
                  {activeTool === "merge" ? "Birden fazla PDF seçebilirsin." : "Tek dosya seç."}
                </div>
              </div>

              {activeTool === "split" && (
                <div className="mt-5">
                  <label className="text-xs font-semibold text-zinc-700">
                    Sayfa aralığı (örn: 1-3,6,8-10)
                  </label>

                  <input
                    value={splitRange}
                    onChange={(e) => setSplitRange(e.target.value)}
                    placeholder="1-3,6,8-10"
                    className={`mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 caret-zinc-900 outline-none focus:ring-2 ${toolMeta.ring}`}
                    disabled={loading}
                  />

                  <p className="mt-2 text-xs text-zinc-500">
                    Virgülle ayır, aralık için “-” kullan.
                  </p>
                </div>
              )}

              <div className="mt-5">
                {files.length > 0 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-zinc-700">
                        Seçilen dosyalar ({files.length})
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {activeTool === "wordToPdf" ? "Word" : "PDF"}
                      </div>
                    </div>

                    <ul className="space-y-2">
                      {files.map((f, index) => (
                        <li
                          key={`${f.name}-${f.size}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-800">
                              {activeTool === "merge" ? `${index + 1}. ` : ""}
                              {f.name}
                            </div>
                            <div className="text-xs text-zinc-500">{formatBytes(f.size)}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            {activeTool === "merge" && (
                              <>
                                <button
                                  onClick={() => moveFileUp(index)}
                                  disabled={index === 0 || loading}
                                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 disabled:opacity-40"
                                >
                                  ↑
                                </button>

                                <button
                                  onClick={() => moveFileDown(index)}
                                  disabled={index === files.length - 1 || loading}
                                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 disabled:opacity-40"
                                >
                                  ↓
                                </button>

                                <button
                                  onClick={() => removeFile(index)}
                                  disabled={loading}
                                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-red-600 disabled:opacity-40"
                                >
                                  Sil
                                </button>
                              </>
                            )}

                            {activeTool !== "merge" && (
                              <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
                                {activeTool === "wordToPdf" ? "DOC/DOCX" : "PDF"}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>

                    {activeTool === "merge" && (
                      <p className="mt-3 text-xs text-zinc-500">
                        Birleştirme sırası yukarıdan aşağıya doğrudur. İstersen ↑ ↓ ile sırayı değiştirebilirsin.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Henüz dosya seçilmedi.</p>
                )}
              </div>

              <button
                onClick={runActive}
                className={`mt-5 w-full rounded-2xl bg-gradient-to-r ${toolMeta.accent} px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-50 focus:outline-none focus:ring-2 ${toolMeta.ring}`}
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    İşleniyor...
                  </span>
                ) : (
                  primaryLabel
                )}
              </button>

              {status && (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                  {status}
                </div>
              )}

              <div className="mt-4 text-xs text-zinc-500">
                İpucu: Daha fazla özellik için iOS uygulamasını kullanabilirsin.
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-semibold">About PDFixx</h2>

          <p className="text-gray-600">
            PDFixx is a simple and fast online tool that helps users manage PDF files easily.
            You can merge multiple PDF documents, split PDF files, and convert Word files to PDF
            in just a few seconds.
          </p>

          <p className="mt-3 text-gray-600">
            Our goal is to provide a clean, fast and privacy-friendly experience.
            Files are processed quickly and are not stored permanently on our servers.
          </p>
        </section>

        <section className="mx-auto mt-12 max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-semibold">Why use PDFixx?</h2>

          <ul className="space-y-2 text-gray-600">
            <li>⚡ Fast PDF processing</li>
            <li>🔒 Privacy-friendly</li>
            <li>📄 No account required</li>
            <li>📱 Works on mobile and desktop</li>
            <li>🚀 Simple and clean interface</li>
          </ul>
        </section>

        <footer className="mt-12 border-t border-zinc-200 pt-8 text-sm text-zinc-500">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} PDFixx</p>

            <div className="flex gap-4">
              <a
                className="hover:text-zinc-700"
                href="https://apps.apple.com/us/app/pdfixx/id6759792522"
                target="_blank"
                rel="noreferrer"
              >
                App Store
              </a>

              <Link className="hover:text-zinc-700" href="/contact">
                Contact
              </Link>

              <Link className="hover:text-zinc-700" href="/privacy">
                Privacy
              </Link>

              <Link className="hover:text-zinc-700" href="/terms">
                Terms
              </Link>

              <Link className="hover:text-zinc-700" href="/about">
                About
              </Link>

              <Link className="hover:text-zinc-700" href="/how-to-merge-pdf">
                Merge Guide
              </Link>

              <Link className="hover:text-zinc-700" href="/how-to-split-pdf">
                Split Guide
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

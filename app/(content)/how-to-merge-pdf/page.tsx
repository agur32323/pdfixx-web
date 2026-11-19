import type { Metadata } from "next";
import Link from "next/link";

import { Bilingual } from "@/components/content";

export const metadata: Metadata = { title: "PDF birleştirme rehberi · How to merge PDFs", alternates: { canonical: "/how-to-merge-pdf" } };

export default function Guide() {
  return (
    <Bilingual
      tr={
        <>
          <h1>PDF nasıl birleştirilir?</h1>
          <p>Raporları, faturaları ya da taranmış sayfaları tek bir PDF&apos;te toplamak birkaç saniye sürer. PDFixx&apos;te birleştirme tamamen tarayıcında yapılır; dosyaların hiçbir yere yüklenmez.</p>
          <h2>Adımlar</h2>
          <ol>
            <li>PDF Birleştir aracını aç.</li>
            <li>PDF&apos;leri seç ya da sayfaya sürükleyip bırak.</li>
            <li>Dosyaları tutup sürükleyerek sırala; birleştirme yukarıdan aşağıya doğru yapılır.</li>
            <li>“PDF&apos;leri birleştir”e dokun ve sonucu indir.</li>
          </ol>
          <h2>İpuçları</h2>
          <ul>
            <li>Şifreli bir PDF eklersen şifresini bir kez sorarız; dosya yine tarayıcında açılır.</li>
            <li>Birleştirdikten sonra “Bu dosyayla devam et” ile sıkıştırabilir, imzalayabilir ya da sayfa numarası ekleyebilirsin.</li>
          </ul>
          <p className="!mt-8">
            <Link href="/merge-pdf" className="press inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold !text-white !no-underline">
              Aracı aç →
            </Link>
          </p>
        </>
      }
      en={
        <>
          <h1>How to merge PDF files</h1>
          <p>Combining reports, invoices or scanned pages into a single PDF takes seconds. In PDFixx, merging happens entirely in your browser; your files are never uploaded.</p>
          <h2>Steps</h2>
          <ol>
            <li>Open the Merge PDF tool.</li>
            <li>Choose your PDFs or drag and drop them onto the page.</li>
            <li>Hold and drag the files to reorder them; they are merged from top to bottom.</li>
            <li>Tap “Merge PDFs” and download the result.</li>
          </ol>
          <h2>Tips</h2>
          <ul>
            <li>If you add a password-protected PDF, we ask for its password once; the file is still opened in your browser.</li>
            <li>After merging, use “Continue with this file” to compress, sign or number the pages.</li>
          </ul>
          <p className="!mt-8">
            <Link href="/merge-pdf" className="press inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold !text-white !no-underline">
              Open the tool →
            </Link>
          </p>
        </>
      }
    />
  );
}

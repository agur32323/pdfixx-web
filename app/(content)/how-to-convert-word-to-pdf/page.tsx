import type { Metadata } from "next";
import Link from "next/link";

import { Bilingual } from "@/components/content";

export const metadata: Metadata = { title: "Word'den PDF'e çevirme rehberi · Word to PDF", alternates: { canonical: "/how-to-convert-word-to-pdf" } };

export default function Guide() {
  return (
    <Bilingual
      tr={
        <>
          <h1>Word nasıl PDF&apos;e çevrilir?</h1>
          <p>DOC ve DOCX belgelerini düzenini bozmadan PDF&apos;e çevirebilirsin. Bu dönüştürme için dosya güvenli bir sunucuya gönderilir ve işlemden sonra silinir.</p>
          <h2>Adımlar</h2>
          <ol>
            <li>Word&apos;den PDF aracını aç.</li>
            <li>DOC, DOCX, ODT ya da RTF dosyanı seç.</li>
            <li>“Dönüştür”e dokun; dosya yüklenir, dönüştürülür ve indirilir.</li>
            <li>Sonucu açabilir, paylaşabilir ya da başka bir araçla devam edebilirsin.</li>
          </ol>
          <h2>İpuçları</h2>
          <ul>
            <li>Excel ve PowerPoint dosyaları için Excel&apos;den PDF ve PowerPoint&apos;ten PDF araçlarını kullan.</li>
            <li>Ters yönde, PDF&apos;den Word&apos;e aracıyla PDF&apos;i düzenlenebilir DOCX&apos;e çevirebilirsin.</li>
            <li>Ücretsiz sürümde günde 5 bulut dönüştürme yapılabilir.</li>
          </ul>
          <p className="!mt-8">
            <Link href="/word-to-pdf" className="press inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold !text-white !no-underline">
              Aracı aç →
            </Link>
          </p>
        </>
      }
      en={
        <>
          <h1>How to convert Word to PDF</h1>
          <p>You can convert DOC and DOCX documents to PDF without breaking their layout. For this conversion the file is sent to a secure server and deleted after processing.</p>
          <h2>Steps</h2>
          <ol>
            <li>Open the Word to PDF tool.</li>
            <li>Choose your DOC, DOCX, ODT or RTF file.</li>
            <li>Tap “Convert”; the file is uploaded, converted and downloaded.</li>
            <li>Open the result, share it or continue with another tool.</li>
          </ol>
          <h2>Tips</h2>
          <ul>
            <li>For Excel and PowerPoint files, use Excel to PDF and PowerPoint to PDF.</li>
            <li>To go the other way, PDF to Word turns a PDF into an editable DOCX.</li>
            <li>The free plan includes 5 cloud conversions a day.</li>
          </ul>
          <p className="!mt-8">
            <Link href="/word-to-pdf" className="press inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold !text-white !no-underline">
              Open the tool →
            </Link>
          </p>
        </>
      }
    />
  );
}

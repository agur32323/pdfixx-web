import type { Metadata } from "next";
import Link from "next/link";

import { Bilingual } from "@/components/content";

export const metadata: Metadata = { title: "PDF bölme rehberi · How to split a PDF", alternates: { canonical: "/how-to-split-pdf" } };

export default function Guide() {
  return (
    <Bilingual
      tr={
        <>
          <h1>PDF nasıl bölünür?</h1>
          <p>Uzun bir PDF&apos;ten yalnızca ihtiyacın olan sayfaları çıkarabilir ya da belgeyi eşit parçalara ayırabilirsin. Bölme tarayıcında yapılır.</p>
          <h2>Adımlar</h2>
          <ol>
            <li>PDF Böl aracını aç ve PDF&apos;ini seç.</li>
            <li>Bölme şeklini seç: aralığa göre (ör. 1-3, 5, 8-10), her N sayfada bir, tüm sayfaları ayır ya da sayfa seç.</li>
            <li>Kaç dosya oluşacağını alttaki özetten gör.</li>
            <li>“PDF&apos;i böl”e dokun; birden çok dosya oluşursa hepsini tek ZIP olarak indirebilirsin.</li>
          </ol>
          <h2>İpuçları</h2>
          <ul>
            <li>“Aralıkları tek dosyada birleştir” seçeneğiyle farklı aralıkları tek PDF&apos;te toplayabilirsin.</li>
            <li>Sayfaların sırasını değiştirmek ya da silmek için Sayfaları Düzenle aracını kullan.</li>
          </ul>
          <p className="!mt-8">
            <Link href="/split-pdf" className="press inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold !text-white !no-underline">
              Aracı aç →
            </Link>
          </p>
        </>
      }
      en={
        <>
          <h1>How to split a PDF</h1>
          <p>You can extract just the pages you need from a long PDF or cut it into equal parts. Splitting happens in your browser.</p>
          <h2>Steps</h2>
          <ol>
            <li>Open the Split PDF tool and choose your PDF.</li>
            <li>Pick how to split: by ranges (e.g. 1-3, 5, 8-10), every N pages, every page, or select pages.</li>
            <li>See how many files will be created in the summary below.</li>
            <li>Tap “Split PDF”; if several files are created you can download them all as one ZIP.</li>
          </ol>
          <h2>Tips</h2>
          <ul>
            <li>With “Merge ranges into one file” you can combine different ranges into a single PDF.</li>
            <li>To reorder or delete pages, use the Organize Pages tool.</li>
          </ul>
          <p className="!mt-8">
            <Link href="/split-pdf" className="press inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold !text-white !no-underline">
              Open the tool →
            </Link>
          </p>
        </>
      }
    />
  );
}

import type { Metadata } from "next";

import { Bilingual } from "@/components/content";
import { APP_STORE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Hakkında · About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <Bilingual
      tr={
        <>
          <h1>PDFixx hakkında</h1>
          <p>PDFixx, PDF işlerini tek yerde toplayan ücretsiz bir araç setidir: birleştirme, bölme, sıkıştırma, imzalama, filigran, sayfa düzenleme, Word, Excel ve PowerPoint dönüştürme, OCR ve belgelerini özetleyen bir yapay zekâ asistanı.</p>
          <p>Araçların çoğu dosyanı yalnızca tarayıcında işler. Dosya hiçbir sunucuya yüklenmediği için hem hızlıdır hem de gizliliğin korunur. Sunucu gerektiren dönüştürmelerde dosya güvenli bir hizmete gönderilir ve işlemden sonra silinir.</p>
          <h2>Web ve iOS</h2>
          <p>Bu site, <a href={APP_STORE_URL}>PDFixx iOS uygulamasının</a> web sürümüdür; aynı araçları ve aynı tasarımı kullanır. Belge tarama, Face ID ile korunan gizli klasör ve Pro aboneliği iPhone ve iPad&apos;de.</p>
          <h2>Neden PDFixx?</h2>
          <ul>
            <li>Hesap gerekmez, kurulum yoktur.</li>
            <li>Telefonda da bilgisayarda da aynı deneyim; istersen ana ekrana uygulama gibi ekleyebilirsin.</li>
            <li>Türkçe ve İngilizce arayüz.</li>
          </ul>
        </>
      }
      en={
        <>
          <h1>About PDFixx</h1>
          <p>PDFixx is a free set of PDF tools in one place: merge, split, compress, sign, watermark, organize pages, convert Word, Excel and PowerPoint, OCR, and an AI assistant that summarizes your documents.</p>
          <p>Most tools process your file only in your browser. Because the file is never uploaded to a server, it&apos;s fast and your privacy is protected. For conversions that need a server, the file is sent to a secure service and deleted after processing.</p>
          <h2>Web and iOS</h2>
          <p>This site is the web version of the <a href={APP_STORE_URL}>PDFixx iOS app</a>, with the same tools and design. Document scanning, a Face ID private folder and the Pro subscription are on iPhone and iPad.</p>
          <h2>Why PDFixx?</h2>
          <ul>
            <li>No account and nothing to install.</li>
            <li>The same experience on your phone and computer; add it to your home screen like an app.</li>
            <li>Turkish and English interface.</li>
          </ul>
        </>
      }
    />
  );
}

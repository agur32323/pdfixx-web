import type { Metadata } from "next";
import Link from "next/link";

import { Bilingual } from "@/components/content";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Kullanım Koşulları · Terms of Use", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <Bilingual
      tr={
        <>
          <h1>Kullanım Koşulları</h1>
          <p>Yürürlük tarihi: 19 Kasım 2026</p>
          <h2>1. Hizmet</h2>
          <p>PDFixx, PDF dosyalarını birleştirme, bölme, dönüştürme, düzenleme ve okuma araçları sunan ücretsiz bir web sitesidir. Bazı araçlar dosyayı üçüncü taraf dönüştürme hizmetlerine ya da yapay zekâ asistanına gönderir; bunlar <Link href="/privacy">Gizlilik Politikası</Link>&apos;nda açıklanır.</p>
          <h2>2. Kullanım</h2>
          <ul>
            <li>Yalnızca kullanma hakkına sahip olduğun dosyaları işle.</li>
            <li>Yasa dışı, zararlı ya da başkalarının haklarını ihlal eden içerik yükleme.</li>
            <li>Şifre kaldırma aracını yalnızca şifresini bildiğin dosyalarda kullan.</li>
            <li>Hizmeti otomatik araçlarla aşırı yükleme ya da kullanım sınırlarını aşmaya çalışma.</li>
          </ul>
          <h2>3. Ücretsiz kullanım sınırları</h2>
          <p>Bulut dönüştürmeler ve yapay zekâ asistanı için günlük kullanım sınırları uygulanır. Sınırlar önceden haber vermeden değişebilir.</p>
          <h2>4. Sorumluluk</h2>
          <p>Hizmet &quot;olduğu gibi&quot; sunulur. Dosyalarının yedeğini almak senin sorumluluğundadır. Yapay zekâ yanıtları hatalı olabilir; önemli kararlar için belgenin aslını kontrol et. Yasaların izin verdiği ölçüde, hizmetin kullanımından doğan dolaylı zararlardan sorumlu değiliz.</p>
          <h2>5. Değişiklikler</h2>
          <p>Bu koşulları güncelleyebiliriz; yeni sürüm bu sayfada yayımlanır.</p>
          <h2>6. İletişim</h2>
          <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
        </>
      }
      en={
        <>
          <h1>Terms of Use</h1>
          <p>Effective date: November 19, 2026</p>
          <h2>1. The service</h2>
          <p>PDFixx is a free website with tools to merge, split, convert, edit and read PDF files. Some tools send the file to third-party conversion services or to the AI assistant; this is described in the <Link href="/privacy">Privacy Policy</Link>.</p>
          <h2>2. Use</h2>
          <ul>
            <li>Only process files you have the right to use.</li>
            <li>Don&apos;t upload illegal or harmful content or content that infringes others&apos; rights.</li>
            <li>Use the password removal tool only on files whose password you know.</li>
            <li>Don&apos;t overload the service with automated tools or try to get around usage limits.</li>
          </ul>
          <h2>3. Free usage limits</h2>
          <p>Daily limits apply to cloud conversions and the AI assistant. Limits may change without notice.</p>
          <h2>4. Liability</h2>
          <p>The service is provided &quot;as is&quot;. Keeping backups of your files is your responsibility. AI answers can be wrong; check the original document before making important decisions. To the extent permitted by law, we are not liable for indirect damages arising from use of the service.</p>
          <h2>5. Changes</h2>
          <p>We may update these terms; the new version is published on this page.</p>
          <h2>6. Contact</h2>
          <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
        </>
      }
    />
  );
}

import type { Metadata } from "next";

import { Bilingual } from "@/components/content";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "İletişim · Contact", alternates: { canonical: "/contact" } };

const card = (label: string) => (
  <div className="card mt-6 p-6">
    <p className="!text-[13px]">{label}</p>
    <a href={`mailto:${SUPPORT_EMAIL}`} className="!text-fg !no-underline text-xl font-bold hover:!underline">
      {SUPPORT_EMAIL}
    </a>
  </div>
);

export default function ContactPage() {
  return (
    <Bilingual
      tr={
        <>
          <h1>İletişim</h1>
          <p>Soru, öneri ya da bir sorun için bize yazabilirsin. Genellikle 1–2 iş günü içinde yanıt veririz.</p>
          {card("E-posta")}
          <h2>Sık sorulanlar</h2>
          <p><strong>Dosyalarım nerede saklanıyor?</strong> Yalnızca bu tarayıcıda (Dosyalarım). Tarayıcı verilerini silersen kaybolurlar; önemli dosyaları indirmeyi unutma.</p>
          <p><strong>Ücretli mi?</strong> Web sitesi ücretsizdir. Bulut dönüştürme ve asistan için günlük sınırlar vardır.</p>
          <p><strong>Pro aboneliğimi web&apos;de kullanabilir miyim?</strong> Pro şimdilik yalnızca iOS uygulamasında geçerlidir.</p>
        </>
      }
      en={
        <>
          <h1>Contact</h1>
          <p>Write to us with questions, suggestions or a problem. We usually reply within 1–2 business days.</p>
          {card("Email")}
          <h2>FAQ</h2>
          <p><strong>Where are my files stored?</strong> Only in this browser (My Files). Clearing browser data removes them, so download the files that matter.</p>
          <p><strong>Is it free?</strong> The website is free. Cloud conversions and the assistant have daily limits.</p>
          <p><strong>Can I use my Pro subscription on the web?</strong> For now, Pro works only in the iOS app.</p>
        </>
      }
    />
  );
}

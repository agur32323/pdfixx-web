import type { Metadata } from "next";

import { Bilingual } from "@/components/content";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gizlilik Politikası · Privacy Policy",
  description: "PDFixx web sitesinin gizlilik politikası: dosyalar tarayıcıda işlenir, bulut araçları, yapay zekâ asistanı, reklam ve çerezler.",
  alternates: { canonical: "/privacy" },
};

const APP_PRIVACY = "https://pdf-tools-app-297bf.web.app/privacy";
const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

const tr = (
  <>
    <h1>Gizlilik Politikası</h1>
    <p>Yürürlük tarihi: 19 Kasım 2026 · Bu politika pdfixx-web.vercel.app adresindeki PDFixx web sitesi içindir. iOS uygulamasının politikası <a href={APP_PRIVACY}>burada</a>.</p>
    <ul>
      <li>Araçların çoğu dosyanı yalnızca tarayıcında işler; dosya hiçbir sunucuya yüklenmez.</li>
      <li>Hesap açman gerekmez; adını, e-postanı ya da telefon numaranı istemeyiz.</li>
      <li>Dosyan tarayıcından yalnızca bir bulut aracını ya da yapay zekâ asistanını kullandığında çıkar.</li>
      <li>Site, Google AdSense reklamları gösterir; bunun için çerezler kullanılabilir (aşağıda 5. madde).</li>
    </ul>

    <h2>1. Tarayıcında kalan veriler</h2>
    <p>
      Birleştirme, bölme, sayfa düzenleme, döndürme, cihazda sıkıştırma, görselden PDF, PDF&apos;den görsele, imza, filigran, sayfa numarası, düzenleme, şifreleme ve şifre kaldırma, PDF okuyucu ve sesli okuma tamamen tarayıcında
      çalışır. Dosyaların &quot;Dosyalarım&quot;da, tarayıcının kendi depolama alanında (IndexedDB) saklanır; ayarların, imzaların, okuma konumların ve yer imlerin de tarayıcında (localStorage) tutulur. Bu verilere biz erişemeyiz.
      Tarayıcı verilerini sildiğinde ya da Ayarlar › Tüm dosyaları sil&apos;i kullandığında kalıcı olarak silinirler.
    </p>

    <h2>2. Bulut dönüştürme araçları</h2>
    <p>Word, Excel ve PowerPoint ile PDF arasında dönüştürme, OCR (metin tanıma), PDF onarma ve bulutta sıkıştırma için dosyan tarayıcından doğrudan şu hizmet sağlayıcılara şifreli bağlantıyla gönderilir:</p>
    <ul>
      <li>
        iLovePDF (İspanya): <a href="https://www.ilovepdf.com/help/privacy">gizlilik politikası</a>
      </li>
      <li>
        ConvertAPI (Litvanya): <a href="https://www.convertapi.com/privacy">gizlilik politikası</a>
      </li>
    </ul>
    <p>
      Sunucumuz yalnızca işlemi başlatır; dosyanın içeriğini görmez ve saklamaz. Şifreli bir PDF seçtiysen, dosyanın açılabilmesi için girdiğin şifre de dosyayla birlikte gönderilir. Sağlayıcılar dosyaları yalnızca işlem için kullanır ve kendi
      politikalarına göre kısa süre içinde siler. Kötüye kullanımı önlemek için sunucumuz istek sayısını IP adresine göre geçici olarak sayar; bu sayı saklanmaz.
    </p>

    <h2>3. Yapay zekâ asistanı</h2>
    <p>
      Asistanı ilk kullandığında senden izin isteriz. İzin verirsen sorduğun belge (PDF dosyası ya da tarayıcında çıkarılan metni), soruların ve aynı sohbetteki önceki yanıtlar, Google Cloud üzerinde (Firebase Cloud Functions, Belçika)
      çalışan sunucumuz aracılığıyla Anthropic&apos;e (Claude, ABD) gönderilir.
    </p>
    <ul>
      <li>Sunucumuz belgeyi, sorularını ya da yanıtları saklamaz.</li>
      <li>Günlük kullanım hakkını uygulayabilmek için tarayıcına özel rastgele bir anonim kimlik (Firebase Authentication) oluşturulur ve bu kimlikle günlük soru sayın tutulur.</li>
      <li>Anthropic, API üzerinden gönderilen verileri modellerini eğitmek için kullanmaz ve kendi politikasına göre sınırlı bir süre sonra siler.</li>
    </ul>
    <p>Yapay zekâ yanıtları hatalı olabilir; önemli kararlar için belgenin aslını kontrol et.</p>

    <h2>4. Analiz</h2>
    <p>Sitenin nasıl kullanıldığını anlamak için Vercel Web Analytics kullanırız. Bu hizmet çerez kullanmaz; yalnızca ziyaret edilen sayfa, ülke, tarayıcı ve cihaz türü gibi toplu ve anonim bilgileri işler.</p>

    <h2>5. Reklamlar ve çerezler</h2>
    <p>
      Sitenin ücretsiz kalabilmesi için Google AdSense reklamları gösteririz. Google dahil üçüncü taraf sağlayıcılar, bu siteye ve diğer sitelere yaptığın önceki ziyaretlere göre reklam göstermek için çerezler kullanır. Google&apos;ın reklam
      çerezleri, Google&apos;ın ve iş ortaklarının bu ziyaretlere göre sana reklam sunmasını sağlar.
    </p>
    <ul>
      <li>
        Kişiselleştirilmiş reklamları <a href="https://adssettings.google.com">Google Reklam Ayarları</a>&apos;ndan kapatabilirsin.
      </li>
      <li>
        Diğer sağlayıcıların çerezlerini <a href="https://www.aboutads.info/choices">aboutads.info</a> üzerinden yönetebilirsin.
      </li>
      <li>
        Google&apos;ın verileri nasıl kullandığı: <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>
      </li>
    </ul>
    <p>Avrupa Ekonomik Alanı, Birleşik Krallık ve İsviçre&apos;deki ziyaretçilerden reklam çerezleri için izin istenir.</p>

    <h2>6. Hakların</h2>
    <p>6698 sayılı KVKK ve GDPR kapsamında verilerine erişme, düzeltilmesini ya da silinmesini isteme ve işlenmesine itiraz etme hakkın var. Taleplerine 30 gün içinde yanıt veririz.</p>

    <h2>7. Çocuklar</h2>
    <p>PDFixx 13 yaşın altındaki çocuklara yönelik değildir ve bu yaştaki çocuklardan bilerek veri toplamayız.</p>

    <h2>8. Değişiklikler</h2>
    <p>Bu politikayı güncellersek yeni sürümü bu sayfada yayımlar ve yürürlük tarihini değiştiririz.</p>

    <h2>9. İletişim</h2>
    <p>{mail}</p>
  </>
);

const en = (
  <>
    <h1>Privacy Policy</h1>
    <p>Effective date: November 19, 2026 · This policy covers the PDFixx website at pdfixx-web.vercel.app. The iOS app&apos;s policy is <a href={`${APP_PRIVACY}?lang=en`}>here</a>.</p>
    <ul>
      <li>Most tools process your file only in your browser; it is never uploaded to a server.</li>
      <li>You don&apos;t need an account; we never ask for your name, email or phone number.</li>
      <li>A file leaves your browser only when you use a cloud tool or the AI assistant.</li>
      <li>The site shows Google AdSense ads, which may use cookies (see section 5).</li>
    </ul>

    <h2>1. Data that stays in your browser</h2>
    <p>
      Merge, split, organize, rotate, on-device compression, image to PDF, PDF to image, signatures, watermarks, page numbers, editing, password protection and removal, the PDF reader and read aloud all run entirely in your browser.
      Your files are kept in &quot;My Files&quot;, in your browser&apos;s own storage (IndexedDB); your settings, signatures, reading positions and bookmarks are kept in your browser too (localStorage). We can&apos;t access this data.
      It is permanently removed when you clear your browser data or use Settings › Delete all files.
    </p>

    <h2>2. Cloud conversion tools</h2>
    <p>For Word, Excel and PowerPoint ↔ PDF conversion, OCR (text recognition), PDF repair and cloud compression, your file is sent from your browser straight to these providers over an encrypted connection:</p>
    <ul>
      <li>
        iLovePDF (Spain): <a href="https://www.ilovepdf.com/help/privacy">privacy policy</a>
      </li>
      <li>
        ConvertAPI (Lithuania): <a href="https://www.convertapi.com/privacy">privacy policy</a>
      </li>
    </ul>
    <p>
      Our server only starts the task; it never sees or stores the file&apos;s contents. If you choose a password-protected PDF, the password you enter is sent with the file so it can be opened. The providers use files only to process them and
      delete them shortly afterwards under their own policies. To prevent abuse, our server briefly counts requests per IP address; the count is not stored.
    </p>

    <h2>3. AI assistant</h2>
    <p>
      The first time you use the assistant, we ask for your permission. If you allow it, the document you ask about (the PDF file or the text extracted in your browser), your questions and earlier answers in the same conversation are sent
      through our server on Google Cloud (Firebase Cloud Functions, Belgium) to Anthropic (Claude, USA).
    </p>
    <ul>
      <li>Our server does not store your documents, questions or answers.</li>
      <li>To enforce the daily allowance, a random anonymous ID for your browser is created (Firebase Authentication) and a daily question count is kept with it.</li>
      <li>Anthropic does not use data sent through its API to train its models and deletes it after a limited period under its own policy.</li>
    </ul>
    <p>AI answers can be wrong; check the original document before making important decisions.</p>

    <h2>4. Analytics</h2>
    <p>We use Vercel Web Analytics to understand how the site is used. It sets no cookies and processes only aggregated, anonymous information such as the page visited, country, browser and device type.</p>

    <h2>5. Ads and cookies</h2>
    <p>
      To keep the site free, we show Google AdSense ads. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites. Google&apos;s advertising cookies enable it and its partners to
      serve ads to you based on those visits.
    </p>
    <ul>
      <li>
        You can opt out of personalized advertising in <a href="https://adssettings.google.com">Google Ads Settings</a>.
      </li>
      <li>
        You can manage other vendors&apos; cookies at <a href="https://www.aboutads.info/choices">aboutads.info</a>.
      </li>
      <li>
        How Google uses data: <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>
      </li>
    </ul>
    <p>Visitors in the European Economic Area, the UK and Switzerland are asked for consent before advertising cookies are used.</p>

    <h2>6. Your rights</h2>
    <p>Under the GDPR and Turkey&apos;s KVKK (Law No. 6698), you have the right to access your data, ask for it to be corrected or deleted, and object to its processing. We answer requests within 30 days.</p>

    <h2>7. Children</h2>
    <p>PDFixx is not directed at children under 13, and we do not knowingly collect data from them.</p>

    <h2>8. Changes</h2>
    <p>If we update this policy, we will publish the new version on this page and change the effective date.</p>

    <h2>9. Contact</h2>
    <p>{mail}</p>
  </>
);

export default function PrivacyPage() {
  return <Bilingual tr={tr} en={en} />;
}

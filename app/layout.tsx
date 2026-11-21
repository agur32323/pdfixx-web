import { Analytics } from "@vercel/analytics/react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import { SITE_URL } from "@/lib/site";
import { themeScript } from "@/lib/theme-script";

import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "PDFixx — Ücretsiz PDF araçları", template: "%s · PDFixx" },
  description:
    "PDF birleştir, böl, sıkıştır, imzala, Word'e çevir ve yapay zekâ asistanıyla özetle. Dosyaların tarayıcında işlenir. Merge, split, compress, sign and convert PDFs for free.",
  applicationName: "PDFixx",
  appleWebApp: { capable: true, title: "PDFixx", statusBarStyle: "default" },
  itunes: { appId: "6759792522" },
  openGraph: { type: "website", siteName: "PDFixx", images: ["/logo.png"] },
  twitter: { card: "summary" },
  formatDetection: { telephone: false },
  // Lets AdSense verify the site by meta tag as well as by its script and ads.txt.
  other: { "google-adsense-account": "ca-pub-1336089357343296" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1336089357343296" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}

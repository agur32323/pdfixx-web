import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "PDFixx Web — Merge, Split, Word to PDF",
  description:
    "PDFixx Web: PDF birleştir, PDF böl, Word → PDF dönüştür. Hızlı ve basit.",
 
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1336089357343296"
     crossOrigin="anonymous"></script></head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
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
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
import type { Metadata } from "next";

import { FilesScreen } from "@/components/files";

export const metadata: Metadata = { title: "Dosyalarım", robots: { index: false } };

export default function FilesPage() {
  return <FilesScreen />;
}

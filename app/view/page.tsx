import type { Metadata } from "next";
import { Suspense } from "react";

import { Viewer } from "@/components/viewer/viewer";

export const metadata: Metadata = { title: "PDF", robots: { index: false } };

export default function ViewPage() {
  return (
    <Suspense>
      <Viewer />
    </Suspense>
  );
}

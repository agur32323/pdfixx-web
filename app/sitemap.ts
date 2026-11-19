import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = ["", "/about", "/privacy", "/terms", "/contact", "/how-to-merge-pdf", "/how-to-split-pdf", "/how-to-convert-word-to-pdf"];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, priority: p === "" ? 1 : 0.5 })),
    ...TOOLS.map((t) => ({ url: `${SITE_URL}/${t.slug}`, lastModified: now, priority: 0.8 })),
  ];
}

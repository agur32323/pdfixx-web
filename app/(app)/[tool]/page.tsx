import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ToolScreen } from "@/components/tool-screen";
import { serverT } from "@/lib/i18n/strings";
import { toolBySlug, TOOLS } from "@/lib/tools";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

type Props = { params: Promise<{ tool: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = toolBySlug((await params).tool);
  if (!tool) return {};
  const tr = serverT("tr");
  const en = serverT("en");
  return {
    title: `${tr(tool.title)} — ${tr(tool.sub)}`,
    description: `${tr(tool.title)}: ${tr(tool.sub)}. ${tr(tool.cloud ? "cloudNote" : "offlineNote")} ${en(tool.title)} online, free.`,
    alternates: { canonical: `/${tool.slug}` },
    openGraph: { title: `${tr(tool.title)} · PDFixx`, description: tr(tool.sub) },
  };
}

export default async function ToolPage({ params }: Props) {
  const tool = toolBySlug((await params).tool);
  if (!tool) notFound();
  return (
    <Suspense>
      <ToolScreen id={tool.id as Parameters<typeof ToolScreen>[0]["id"]} />
    </Suspense>
  );
}

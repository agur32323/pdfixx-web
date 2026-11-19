import { ContentShell } from "@/components/content";

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return <ContentShell>{children}</ContentShell>;
}

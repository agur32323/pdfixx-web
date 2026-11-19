import type { Metadata } from "next";

import { SettingsScreen } from "@/components/settings";

export const metadata: Metadata = { title: "Ayarlar", robots: { index: false } };

export default function SettingsPage() {
  return <SettingsScreen />;
}

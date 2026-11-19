// Copies the mobile app's strings (Flutter ARB files) into lib/i18n so the
// site and the app say the same thing. Run after changing the app's ARB files:
//   node scripts/sync-strings.mjs [path-to-pdf_tools_app]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const app = process.argv[2] ?? join(import.meta.dirname, "../../PDFixx/pdf_tools_app");
for (const lang of ["tr", "en"]) {
  const arb = JSON.parse(readFileSync(join(app, `lib/l10n/app_${lang}.arb`), "utf8"));
  const strings = Object.fromEntries(Object.entries(arb).filter(([k]) => !k.startsWith("@")));
  writeFileSync(join(import.meta.dirname, `../lib/i18n/app.${lang}.json`), JSON.stringify(strings, null, 2) + "\n");
  console.log(lang, Object.keys(strings).length, "strings");
}

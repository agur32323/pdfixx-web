// pdf.js renders in a web worker and loads fonts and character maps on demand;
// all of them must be served as static files.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const from = join(root, "node_modules/pdfjs-dist");
const to = join(root, "public/pdfjs");
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(join(from, "build/pdf.worker.min.mjs"), join(to, "pdf.worker.min.mjs"));
cpSync(join(from, "standard_fonts"), join(to, "standard_fonts"), { recursive: true });
cpSync(join(from, "cmaps"), join(to, "cmaps"), { recursive: true });

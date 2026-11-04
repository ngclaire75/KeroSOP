// pdf.js runs its parser in a worker and needs character maps for Chinese
// PDFs. Copy both from the installed package into public/, so the versions
// always match the library the app imports.
import { cpSync, mkdirSync } from "node:fs";

const from = "node_modules/pdfjs-dist";
const to = "public/pdfjs";
mkdirSync(to, { recursive: true });
// the legacy build: same API, compiled for wider browser support (Safari included)
cpSync(`${from}/legacy/build/pdf.worker.min.mjs`, `${to}/pdf.worker.min.mjs`);
cpSync(`${from}/cmaps`, `${to}/cmaps`, { recursive: true });
cpSync(`${from}/standard_fonts`, `${to}/standard_fonts`, { recursive: true });

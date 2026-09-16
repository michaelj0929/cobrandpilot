import { unzipSync, strFromU8 } from "fflate";
import type { AgentFile } from "./ai-gateway.server";

export const NATIVE_MEDIA = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<\/w:p>|<\/a:p>|<\/w:tr>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Word document: main body XML. */
export function extractDocxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const parts: string[] = [];
  for (const name of ["word/document.xml", "word/header1.xml", "word/footer1.xml"]) {
    const entry = files[name];
    if (entry) parts.push(xmlToText(strFromU8(entry)));
  }
  return parts.join("\n\n").trim();
}

/** PowerPoint / Keynote export: each slide becomes a labelled section. */
export function extractPptxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const slideNames = Object.keys(files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  const sections: string[] = [];
  for (const name of slideNames) {
    const slideNumber = name.match(/slide(\d+)/)?.[1] ?? "?";
    const entry = files[name];
    if (!entry) continue;
    const text = xmlToText(strFromU8(entry));
    const notesName = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
    const notesEntry = files[notesName];
    const notes = notesEntry ? xmlToText(strFromU8(notesEntry)) : "";
    sections.push(
      `--- Slide ${slideNumber} ---\n${text}${notes ? `\n[Speaker notes] ${notes}` : ""}`,
    );
  }
  return sections.join("\n\n").trim();
}

/** SVG: readable markup plus the colours it uses. */
export function extractSvgText(bytes: Uint8Array): string {
  const svg = strFromU8(bytes);
  const colors = Array.from(new Set(svg.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []));
  const titles = Array.from(svg.matchAll(/<title[^>]*>([^<]*)<\/title>/g)).map((m) => m[1]);
  return [
    "This is an SVG brand asset (likely a logo or icon).",
    titles.length ? `Titles: ${titles.join(", ")}` : "",
    colors.length ? `Colours used in the file: ${colors.join(", ")}` : "",
    `Raw markup (truncated):\n${svg.slice(0, 6000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type PreparedSource = {
  /** Text handed to the model, if the file was parsed locally. */
  text: string | null;
  /** Native file handed to the model (PDF / image). */
  file: AgentFile | null;
  note: string;
};

export function prepareSource(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
): PreparedSource {
  const lower = fileName.toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    return {
      text: null,
      file: { mediaType: "application/pdf", data: toBase64(bytes), filename: fileName },
      note: "PDF read directly, page by page.",
    };
  }

  if (mime.startsWith("image/") && !lower.endsWith(".svg")) {
    const mediaType = mime === "image/jpg" ? "image/jpeg" : mime || "image/png";
    return {
      text: null,
      file: { mediaType, data: toBase64(bytes), filename: fileName },
      note: "Image read directly.",
    };
  }

  if (lower.endsWith(".docx")) {
    return { text: extractDocxText(bytes), file: null, note: "Word document text extracted." };
  }

  if (lower.endsWith(".pptx")) {
    return { text: extractPptxText(bytes), file: null, note: "Deck text extracted slide by slide." };
  }

  if (lower.endsWith(".svg") || mime === "image/svg+xml") {
    return { text: extractSvgText(bytes), file: null, note: "SVG asset inspected." };
  }

  // Plain text and anything else readable.
  try {
    return { text: strFromU8(bytes), file: null, note: "Text read directly." };
  } catch {
    throw new Error(`CoBrand can't read ${fileName} yet. Try a PDF, image, Word or PowerPoint file.`);
  }
}

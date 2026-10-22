/** Helpers that read classification results and document records. */
import type {
  ClassificationResult,
  DocumentRecord,
  FinancialData,
  RecurrenceData,
} from "../../shared/types";

/** Below this confidence a classification is flagged "Da verificare". */
export const REVIEW_THRESHOLD = 0.6;

/** Dot colour per classifier category (unknown categories fall back to "Altro"). */
const CATEGORY_DOTS: Record<string, string> = {
  Assicurazione: "bg-sky-500",
  Banca: "bg-emerald-500",
  Fatture: "bg-orange-500",
  Imposte: "bg-rose-500",
  Salute: "bg-pink-500",
  Lavoro: "bg-violet-500",
  Abitazione: "bg-amber-500",
  Veicolo: "bg-cyan-500",
  Amministrativo: "bg-slate-500",
  Educazione: "bg-indigo-500",
  Altro: "bg-zinc-400",
};

export function categoryDot(category?: string | null): string {
  return CATEGORY_DOTS[category ?? ""] ?? CATEGORY_DOTS.Altro;
}

/** Workflow stage of a file, from the DB status ("pending" | "classified" | "archived"). */
export type Stage = "new" | "analyzed" | "archived";

export function stageOf(status: string | null | undefined): Stage {
  if (status === "archived") return "archived";
  if (status === "classified") return "analyzed";
  return "new";
}

export function parseClassification(json: string | null | undefined): ClassificationResult | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ClassificationResult;
  } catch {
    return null;
  }
}

export function financialOf(c: ClassificationResult | null): FinancialData | null {
  const f = c?.extracted_data?.financial;
  return f && typeof f === "object" ? f : null;
}

export function recurrenceOf(c: ClassificationResult | null): RecurrenceData | null {
  const r = c?.ricorrenza;
  return r && typeof r === "object" ? r : null;
}

export function confidenceOf(c: ClassificationResult | null): number | null {
  const score = c?.ai_analysis?.confidence_score;
  return typeof score === "number" ? score : null;
}

export function needsReview(c: ClassificationResult | null): boolean {
  if (!c) return false;
  const score = confidenceOf(c);
  return Boolean(c.ai_analysis?.needs_human_validation) || (score != null && score < REVIEW_THRESHOLD);
}

export interface Destination {
  path: string;
  filename: string;
}

export function destinationOf(c: ClassificationResult | null): Destination | null {
  const path = c?.filing_strategy?.full_suggested_path?.trim();
  const filename = c?.filing_strategy?.suggested_filename?.trim();
  return path && filename ? { path, filename } : null;
}

export function pathSegments(path?: string | null): string[] {
  return (path ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function displayName(doc: DocumentRecord): string {
  return doc.archived_filename?.trim() || doc.original_name;
}

export function archivedLocation(doc: DocumentRecord): string {
  const path = (doc.archived_path ?? "").replace(/\/+$/, "");
  const filename = (doc.archived_filename ?? "").replace(/^\/+/, "");
  if (!path) return filename;
  if (!filename) return path;
  return `${path}/${filename}`;
}

/**
 * True when the latest classification suggests a different place than where
 * the document was archived (or it was never archived).
 */
export function needsRearchive(doc: DocumentRecord): boolean {
  const dest = destinationOf(parseClassification(doc.classification_json));
  if (!dest) return false;
  if (!doc.archived_path && !doc.archived_filename) return true;
  const currentPath = (doc.archived_path ?? "").replace(/\/+$/, "");
  if (currentPath !== dest.path.replace(/\/+$/, "")) return true;
  const stripExt = (f: string) => f.replace(/^\/+/, "").replace(/\.[^.]+$/, "");
  return stripExt(doc.archived_filename ?? "") !== stripExt(dest.filename);
}

export type FileKind = "pdf" | "image" | "doc" | "sheet" | "other";

export function fileKind(mimeType?: string | null, name?: string): FileKind {
  const mime = mimeType ?? "";
  if (mime === "application/pdf" || /\.pdf$/i.test(name ?? "")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (/spreadsheet|excel|csv/.test(mime)) return "sheet";
  if (/document|word|text\//.test(mime)) return "doc";
  return "other";
}

export function canPreview(mimeType?: string | null): boolean {
  const mime = mimeType ?? "";
  return mime === "application/pdf" || mime.startsWith("image/") || mime.startsWith("application/vnd.google-apps.");
}

export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

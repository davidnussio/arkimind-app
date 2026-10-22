/** Italian formatting helpers for dates, sizes, money and AI enum values. */

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthFormat = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });

/**
 * Formats ISO timestamps and the `document_date` strings returned by the
 * classifier (YYYY-MM-DD, YYYY-MM or free text, which is returned as is).
 */
export function formatDate(value?: string | null): string {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) return dayFormat.format(new Date(+day[1], +day[2] - 1, +day[3]));
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) return monthFormat.format(new Date(+month[1], +month[2] - 1, 1));
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return dayFormat.format(date);
  }
  return value;
}

export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

export function formatSize(bytes?: string | number | null): string {
  if (bytes == null || bytes === "") return "";
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!Number.isFinite(b)) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`;
}

export function formatMoney(amount?: number | null, currency?: string | null): string {
  if (amount == null) return "";
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency || "EUR",
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })} ${currency ?? ""}`.trim();
  }
}

export function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** "1 file" / "3 file", "1 documento" / "3 documenti". */
export function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("it-IT")} ${count === 1 ? one : many}`;
}

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Settimanale",
  monthly: "Mensile",
  quarterly: "Trimestrale",
  annual: "Annuale",
  unknown: "Non nota",
};

export const RECURRENCE_TYPE_LABELS: Record<string, string> = {
  subscription: "Abbonamento",
  utility: "Utenza",
  rent: "Affitto",
  installment: "Rata",
  maintenance: "Manutenzione",
  one_time: "Una tantum",
  unknown: "Non specificato",
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  high: "Affidabilità alta",
  medium: "Affidabilità media",
  low: "Affidabilità bassa",
};

/** Backend errors that are written in English and have a clear fix in the UI. */
const KNOWN_ERRORS: Array<[RegExp, string]> = [
  [/API key not configured|API base URL not configured/i, "Il servizio di analisi non è configurato: aggiungi indirizzo e chiave nelle Impostazioni."],
  [/Archive root folder not configured/i, "Scegli la cartella archivio nelle Impostazioni prima di archiviare."],
  [/Not authenticated/i, "Google Drive non è collegato: accedi con Google e riprova."],
  [/RPC not connected/i, "Arkimind non riesce a comunicare con il processo principale. Riavvia l'app."],
  [/credentials\.json not found/i, "File credentials.json non trovato: copialo in ~/.arkimind/credentials.json e riprova."],
  [/Classification API error \((\d+)\)/i, "Il servizio di analisi ha risposto con un errore ($1). Riprova tra poco."],
  [/Document not found/i, "Il documento non è più nell'archivio di Arkimind: analizzalo di nuovo."],
];

export function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Si è verificato un errore imprevisto";
  for (const [pattern, message] of KNOWN_ERRORS) {
    const match = pattern.exec(raw);
    if (match) return message.replace("$1", match[1] ?? "");
  }
  return raw;
}

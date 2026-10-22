/**
 * DEV ONLY — in-memory stand-in for `lib/api.ts`, wired in by
 * `vite.preview.config.ts` (`bun run preview:mock`). Never imported by the
 * production build. Lets every screen render without Electrobun or a Google
 * account.
 *
 * Scenarios (query string): `?scenario=default|onboarding|signedout|empty|errors|crash`
 * and `&slow=1` to stretch every call to ~4 s for loading states.
 */
import type { api as RealApi } from "@/lib/api";
import type {
  AppSettings,
  BrowsedFolder,
  ClassificationResult,
  DocumentRecord,
  DriveFileInfo,
  EnrichedDriveFile,
  InboxFolder,
} from "../../shared/types";

type Api = typeof RealApi;

const params = new URLSearchParams(window.location.search);
const scenario = params.get("scenario") ?? "default";
const slow = params.get("slow") === "1";

if (scenario === "onboarding") {
  localStorage.removeItem("arkimind-onboarding-done");
} else {
  localStorage.setItem("arkimind-onboarding-done", "true");
}

function wait<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), slow ? 4000 : ms));
}

function fail(message: string, ms = 400): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), slow ? 4000 : ms));
}

// --- Classification fixtures ---

function classification(c: {
  category: string;
  entity: string;
  type: string;
  date: string;
  path: string;
  filename: string;
  confidence: number;
  reasoning: string;
  tax?: string;
  amount?: number;
  currency?: string;
  paid?: boolean;
  invoice?: boolean;
  recurring?: { frequency: "monthly" | "annual" | "quarterly"; type: "subscription" | "utility" | "rent" | "installment" };
}): ClassificationResult {
  return {
    document_profile: {
      category: c.category,
      entity: c.entity,
      document_type: c.type,
      document_date: c.date,
      is_tax_relevant: Boolean(c.tax),
      tax_notes: c.tax,
    },
    filing_strategy: {
      full_suggested_path: c.path,
      suggested_filename: c.filename,
      requires_year_folder: true,
    },
    extracted_data: {
      financial:
        c.amount != null
          ? {
              amount: c.amount,
              currency: c.currency ?? "EUR",
              is_paid: c.paid,
              is_invoice: c.invoice,
              handwritten_notes: { detected: false },
            }
          : false,
    },
    ai_analysis: {
      confidence_score: c.confidence,
      needs_human_validation: c.confidence < 0.6,
      reasoning: c.reasoning,
    },
    ricorrenza: c.recurring
      ? {
          is_recurring: true,
          confidence: "high",
          frequency: c.recurring.frequency,
          recurrence_type: c.recurring.type,
          signals: ["periodo di fatturazione", "numero cliente", "addebito diretto"],
          reasoning: "Il documento riporta un periodo di fatturazione e un contratto attivo con addebito periodico.",
        }
      : false,
  };
}

const enel = classification({
  category: "Abitazione",
  entity: "Enel Energia",
  type: "Bolletta luce",
  date: "2026-09-30",
  path: "Casa/Utenze/Enel/2026",
  filename: "2026-09-30_Enel_Bolletta-luce",
  confidence: 0.94,
  reasoning: "Intestazione Enel Energia, periodo di fatturazione agosto–settembre 2026, importo da pagare e codice POD.",
  amount: 84.37,
  paid: false,
  invoice: true,
  recurring: { frequency: "monthly", type: "utility" },
});

const comune = classification({
  category: "Amministrativo",
  entity: "Comune di Lugano",
  type: "Comunicazione",
  date: "2026-10-02",
  path: "Amministrazione/Comune/2026",
  filename: "2026-10-02_Comune-di-Lugano_Comunicazione",
  confidence: 0.48,
  reasoning: "Il testo è parzialmente illeggibile: si riconosce lo stemma del Comune ma non l'oggetto della comunicazione.",
});

const swisscom = classification({
  category: "Fatture",
  entity: "Swisscom",
  type: "Fattura telefonia mobile",
  date: "2026-10-01",
  path: "Fatture/Telefonia/Swisscom/2026",
  filename: "2026-10-01_Swisscom_Fattura-mobile",
  confidence: 0.88,
  reasoning: "Fattura mensile con numero cliente, dettaglio traffico e importo addebitato su carta.",
  amount: 49.9,
  currency: "CHF",
  paid: true,
  invoice: true,
  recurring: { frequency: "monthly", type: "subscription" },
});

// --- Mutable state ---

let authenticated = scenario !== "signedout" && scenario !== "onboarding";

const settings: AppSettings =
  scenario === "onboarding"
    ? { apiKey: null, apiBaseUrl: null, archiveRootFolderId: null, archiveRootFolderName: null }
    : {
        apiKey: "sk-test-arkimind-0000",
        apiBaseUrl: "https://api.arkimind.test",
        archiveRootFolderId: "fld-archive",
        archiveRootFolderName: "Archivio",
      };

let inboxFolders: InboxFolder[] =
  scenario === "onboarding" || scenario === "empty"
    ? []
    : [
        { id: 1, driveFolderId: "fld-scan", name: "Scansioni" },
        { id: 2, driveFolderId: "fld-mail", name: "Allegati email" },
      ];

function file(
  id: string,
  name: string,
  mimeType: string,
  size: number,
  modified: string,
  c: ClassificationResult | null = null,
): EnrichedDriveFile {
  return {
    id,
    name,
    mimeType,
    size: String(size),
    modifiedTime: modified,
    classificationStatus: c ? "classified" : null,
    classification: c,
  };
}

const files: Record<string, EnrichedDriveFile[]> = {
  "fld-scan": [
    file("f1", "Scan_2026-10-14_093112.pdf", "application/pdf", 412_330, "2026-10-14T09:31:12Z"),
    file("f2", "bolletta_enel_settembre.pdf", "application/pdf", 238_114, "2026-10-12T18:02:00Z", enel),
    file("f3", "IMG_4821.jpg", "image/jpeg", 2_811_004, "2026-10-11T07:45:00Z"),
    file("f4", "documento.pdf", "application/pdf", 96_220, "2026-10-03T11:20:00Z", comune),
  ],
  "fld-mail": [
    file("f5", "Fattura_FT-2026-0912.pdf", "application/pdf", 154_002, "2026-10-01T08:00:00Z", swisscom),
    file("f6", "Polizza_auto_2027.pdf", "application/pdf", 1_204_551, "2026-09-28T14:10:00Z"),
    file("f7", "certificato_medico.png", "image/png", 640_118, "2026-09-25T16:40:00Z"),
  ],
};

let docId = 100;
function record(d: {
  name: string;
  archivedName?: string;
  path?: string;
  status: "classified" | "archived";
  c: ClassificationResult;
  updated: string;
  mime?: string;
}): DocumentRecord {
  const p = d.c.document_profile;
  const r = d.c.ricorrenza;
  return {
    id: docId++,
    drive_file_id: `doc-${docId}`,
    original_name: d.name,
    mime_type: d.mime ?? "application/pdf",
    classification_json: JSON.stringify(d.c),
    category: p.category,
    entity: p.entity,
    document_type: p.document_type,
    document_date: p.document_date,
    is_tax_relevant: p.is_tax_relevant ? 1 : 0,
    is_recurring: r && r.is_recurring ? 1 : 0,
    archived_path: d.status === "archived" ? (d.path ?? d.c.filing_strategy.full_suggested_path) : null,
    archived_filename: d.status === "archived" ? (d.archivedName ?? `${d.c.filing_strategy.suggested_filename}.pdf`) : null,
    status: d.status,
    inbox_folder_id: "fld-scan",
    created_at: d.updated,
    updated_at: d.updated,
  };
}

function seedDocuments(): DocumentRecord[] {
  const rows: DocumentRecord[] = [];
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];
  months.forEach((m, i) => {
    rows.push(
      record({
        name: `enel_${m}.pdf`,
        status: "archived",
        updated: `2026-${m}-28T10:00:00Z`,
        c: classification({
          category: "Abitazione",
          entity: "Enel Energia",
          type: "Bolletta luce",
          date: `2026-${m}-${i % 2 ? "28" : "30"}`,
          path: "Casa/Utenze/Enel/2026",
          filename: `2026-${m}-30_Enel_Bolletta-luce`,
          confidence: 0.93,
          reasoning: "Bolletta mensile Enel Energia.",
          amount: 70 + i * 3.17,
          paid: true,
          invoice: true,
          recurring: { frequency: "monthly", type: "utility" },
        }),
      }),
    );
  });
  rows.push(
    record({
      name: "730_precompilato_2026.pdf",
      status: "archived",
      updated: "2026-07-15T09:00:00Z",
      c: classification({
        category: "Imposte",
        entity: "Agenzia delle Entrate",
        type: "Modello 730",
        date: "2026-07-10",
        path: "Imposte/Dichiarazioni/2026",
        filename: "2026-07-10_Agenzia-Entrate_730",
        confidence: 0.97,
        reasoning: "Modello 730 precompilato con codice fiscale e quadro riepilogativo.",
        tax: "Dichiarazione dei redditi 2025",
      }),
    }),
    record({
      name: "ricevuta_farmacia.jpg",
      mime: "image/jpeg",
      status: "archived",
      archivedName: "2026-06-03_Farmacia-Centrale_Scontrino.jpg",
      updated: "2026-06-04T12:00:00Z",
      c: classification({
        category: "Salute",
        entity: "Farmacia Centrale",
        type: "Scontrino parlante",
        date: "2026-06-03",
        path: "Salute/Spese mediche/2026",
        filename: "2026-06-03_Farmacia-Centrale_Scontrino",
        confidence: 0.81,
        reasoning: "Scontrino con codice fiscale: spesa sanitaria detraibile.",
        tax: "Detraibile al 19%",
        amount: 23.5,
        paid: true,
      }),
    }),
    record({
      name: "polizza_casa_2026.pdf",
      status: "archived",
      path: "Assicurazioni/Casa",
      updated: "2026-03-02T09:00:00Z",
      c: classification({
        category: "Assicurazione",
        entity: "Generali Italia",
        type: "Polizza abitazione",
        date: "2026-02-27",
        path: "Assicurazioni/Casa/2026",
        filename: "2026-02-27_Generali_Polizza-casa",
        confidence: 0.9,
        reasoning: "Condizioni di polizza multirischio abitazione con premio annuale.",
        amount: 312,
        paid: true,
        recurring: { frequency: "annual", type: "subscription" },
      }),
    }),
    record({
      name: "busta_paga_settembre.pdf",
      status: "classified",
      updated: "2026-10-10T08:00:00Z",
      c: classification({
        category: "Lavoro",
        entity: "Acme S.p.A.",
        type: "Cedolino",
        date: "2026-09-30",
        path: "Lavoro/Buste paga/2026",
        filename: "2026-09-30_Acme_Cedolino",
        confidence: 0.95,
        reasoning: "Cedolino mensile con matricola e netto in busta.",
        amount: 2480.12,
        tax: "Ritenute IRPEF",
      }),
    }),
    record({
      name: "contratto_affitto.pdf",
      status: "archived",
      updated: "2026-01-12T08:00:00Z",
      c: classification({
        category: "Abitazione",
        entity: "Immobiliare Rossi",
        type: "Contratto di locazione",
        date: "2026-01-10",
        path: "Casa/Affitto",
        filename: "2026-01-10_Immobiliare-Rossi_Contratto-locazione",
        confidence: 0.89,
        reasoning: "Contratto 4+4 con canone mensile e deposito cauzionale.",
        amount: 950,
        tax: "Detrazione per inquilini",
        recurring: { frequency: "monthly", type: "rent" },
      }),
    }),
    record({
      name: "bollo_auto.pdf",
      status: "archived",
      updated: "2026-04-20T08:00:00Z",
      c: classification({
        category: "Veicolo",
        entity: "ACI",
        type: "Ricevuta bollo auto",
        date: "2026-04-18",
        path: "Veicolo/Bollo/2026",
        filename: "2026-04-18_ACI_Bollo",
        confidence: 0.92,
        reasoning: "Ricevuta di pagamento tassa automobilistica.",
        amount: 186.4,
        paid: true,
        recurring: { frequency: "annual", type: "installment" },
      }),
    }),
    record({
      name: "estratto_conto_q3.pdf",
      status: "archived",
      updated: "2026-10-05T08:00:00Z",
      c: classification({
        category: "Banca",
        entity: "Intesa Sanpaolo",
        type: "Estratto conto",
        date: "2026-09-30",
        path: "Banca/Intesa/Estratti conto/2026",
        filename: "2026-09-30_Intesa_Estratto-conto-Q3",
        confidence: 0.96,
        reasoning: "Estratto conto trimestrale con saldo iniziale e finale.",
        recurring: { frequency: "quarterly", type: "subscription" },
      }),
    }),
    record({
      name: "iscrizione_corso.pdf",
      status: "classified",
      updated: "2026-09-12T08:00:00Z",
      c: classification({
        category: "Educazione",
        entity: "SUPSI",
        type: "Conferma iscrizione",
        date: "2026-09-10",
        path: "Educazione/SUPSI/2026",
        filename: "2026-09-10_SUPSI_Conferma-iscrizione",
        confidence: 0.55,
        reasoning: "Conferma di iscrizione, ma la data del corso non è chiara.",
        amount: 450,
        paid: false,
      }),
    }),
  );
  return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

let documents: DocumentRecord[] = scenario === "onboarding" || scenario === "empty" ? [] : seedDocuments();

const folderTree: Record<string, BrowsedFolder[]> = {
  root: [
    { id: "fld-archive", name: "Archivio", mimeType: "application/vnd.google-apps.folder" },
    { id: "fld-docs", name: "Documenti", mimeType: "application/vnd.google-apps.folder" },
    { id: "fld-scan", name: "Scansioni", mimeType: "application/vnd.google-apps.folder" },
    { id: "fld-mail", name: "Allegati email", mimeType: "application/vnd.google-apps.folder" },
    { id: "fld-photo", name: "Foto", mimeType: "application/vnd.google-apps.folder" },
  ],
  "fld-docs": [
    { id: "fld-docs-2025", name: "2025", mimeType: "application/vnd.google-apps.folder" },
    { id: "fld-docs-2026", name: "2026", mimeType: "application/vnd.google-apps.folder" },
  ],
};

function findFile(fileId: string): { folderId: string; file: EnrichedDriveFile } | null {
  for (const folderId in files) {
    const f = files[folderId].find((x) => x.id === fileId);
    if (f) return { folderId, file: f };
  }
  return null;
}

function guessClassification(name: string): ClassificationResult {
  const base = name.replace(/\.[^.]+$/, "");
  return classification({
    category: /polizza/i.test(name) ? "Assicurazione" : /medic/i.test(name) ? "Salute" : "Altro",
    entity: /polizza/i.test(name) ? "UnipolSai" : /medic/i.test(name) ? "Studio medico Bianchi" : "Sconosciuto",
    type: /polizza/i.test(name) ? "Polizza RC auto" : /medic/i.test(name) ? "Certificato medico" : "Documento",
    date: "2026-10-14",
    path: /polizza/i.test(name) ? "Assicurazioni/Auto/2027" : /medic/i.test(name) ? "Salute/Certificati/2026" : "Da smistare/2026",
    filename: `2026-10-14_${base.replace(/[^A-Za-z0-9]+/g, "-")}`,
    confidence: /polizza|medic/i.test(name) ? 0.86 : 0.42,
    reasoning: "Classificazione simulata (mock di sviluppo).",
  });
}

function pdfDataUrl(title: string): string {
  const text = title.replace(/[()\\]/g, "");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 22 Tf 60 760 Td (${text}) Tj ET BT /F1 12 Tf 60 730 Td (Anteprima generata dal mock di sviluppo) Tj ET`;
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(pdf)}`;
}

function imageDataUrl(title: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
<rect width="900" height="1200" fill="#f4f1ea"/><rect x="80" y="90" width="740" height="1020" rx="8" fill="#fff" stroke="#ddd"/>
<text x="130" y="200" font-family="Helvetica" font-size="40" fill="#333">${title}</text>
${Array.from({ length: 14 }, (_, i) => `<rect x="130" y="${270 + i * 52}" width="${560 - (i % 4) * 90}" height="16" rx="8" fill="#e5e2da"/>`).join("")}
</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export const api: Api = {
  // --- Auth ---
  getAuthStatus: () => wait({ authenticated }, 120),
  login: () =>
    wait(null, 1200).then(() => {
      authenticated = true;
      return { success: true };
    }),
  logout: () => {
    authenticated = false;
    return wait({ success: true });
  },

  // --- Settings ---
  getSettings: () => wait({ ...settings }, 120),
  saveSetting: (key: string, value: string) => {
    if (key === "api_key") settings.apiKey = value;
    if (key === "api_base_url") settings.apiBaseUrl = value;
    if (key === "archive_root_folder_id") settings.archiveRootFolderId = value;
    if (key === "archive_root_folder_name") settings.archiveRootFolderName = value;
    return wait({ success: true });
  },
  deleteSetting: () => wait({ success: true }),

  // --- Inbox Folders ---
  // "crash" renders an object as text so the ErrorBoundary screen shows up.
  getInboxFolders: () =>
    wait(scenario === "crash" ? [{ id: 1, driveFolderId: "x", name: {} as unknown as string }] : [...inboxFolders]),
  addInboxFolder: (driveFolderId: string, name: string) => {
    inboxFolders = [...inboxFolders, { id: inboxFolders.length + 10, driveFolderId, name }];
    files[driveFolderId] ??= [];
    return wait({ success: true });
  },
  removeInboxFolder: (id: number) => {
    inboxFolders = inboxFolders.filter((f) => f.id !== id);
    return wait({ success: true });
  },

  // --- Drive ---
  listFiles: (folderId: string) => {
    if (!authenticated) return fail("Non autenticato con Google Drive");
    if (scenario === "errors" && folderId === "fld-mail") {
      return fail("Errore di rete: impossibile contattare Google Drive (ETIMEDOUT)", 900);
    }
    return wait([...(files[folderId] ?? [])], 700);
  },
  browseFolders: (parentId?: string) => {
    if (!authenticated) return fail("Non autenticato con Google Drive");
    return wait(folderTree[parentId ?? "root"] ?? [], 400);
  },
  getFilePreview: async (fileId: string, mimeType: string) => {
    await wait(null, 600);
    if (scenario === "errors") return null;
    const name = findFile(fileId)?.file.name ?? documents.find((d) => d.drive_file_id === fileId)?.original_name ?? fileId;
    return { dataUrl: mimeType.startsWith("image/") ? imageDataUrl(name) : pdfDataUrl(name) };
  },

  // --- Upload ---
  uploadFile: async (folderId: string, f: File) => {
    await wait(null, 900);
    const info: DriveFileInfo = {
      id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      mimeType: f.type || "application/octet-stream",
      size: String(f.size),
      modifiedTime: new Date().toISOString(),
    };
    (files[folderId] ??= []).unshift({ ...info, classificationStatus: null, classification: null });
    return { success: true, file: info };
  },
  openFileDialog: async (folderId: string) => {
    await wait(null, 900);
    const info: DriveFileInfo = {
      id: `dlg-${Date.now()}`,
      name: "Nuovo_documento.pdf",
      mimeType: "application/pdf",
      size: "88000",
      modifiedTime: new Date().toISOString(),
    };
    (files[folderId] ??= []).unshift({ ...info, classificationStatus: null, classification: null });
    return { success: true, uploaded: [info] };
  },

  // --- Classification & Archive ---
  classifyFile: async (fileId: string) => {
    await wait(null, 1400);
    if (scenario === "errors") {
      throw new Error("Classification API error (503): servizio temporaneamente non disponibile");
    }
    const hit = findFile(fileId);
    const doc = documents.find((d) => d.drive_file_id === fileId);
    const c = hit?.file.classification ?? (doc?.classification_json ? JSON.parse(doc.classification_json) : null) ?? guessClassification(hit?.file.name ?? doc?.original_name ?? "documento.pdf");
    if (hit) {
      hit.file.classificationStatus = hit.file.classificationStatus === "archived" ? "archived" : "classified";
      hit.file.classification = c;
      if (!documents.some((d) => d.drive_file_id === fileId)) {
        documents.unshift({
          ...record({ name: hit.file.name, status: "classified", c, updated: new Date().toISOString(), mime: hit.file.mimeType }),
          drive_file_id: fileId,
        });
      }
    }
    if (doc) doc.updated_at = new Date().toISOString();
    return { success: true, classification: c };
  },
  archiveFile: async (fileId: string, targetPath: string, targetFilename: string) => {
    await wait(null, 900);
    const hit = findFile(fileId);
    if (hit) files[hit.folderId] = files[hit.folderId].filter((f) => f.id !== fileId);
    const doc = documents.find((d) => d.drive_file_id === fileId);
    const ext = (hit?.file.name ?? doc?.original_name ?? "").match(/\.[^.]+$/)?.[0] ?? "";
    const filename = /\.[^.]+$/.test(targetFilename) ? targetFilename : targetFilename + ext;
    if (doc) {
      doc.status = "archived";
      doc.archived_path = targetPath;
      doc.archived_filename = filename;
      doc.updated_at = new Date().toISOString();
    }
    return { success: true };
  },

  // --- Documents ---
  getDocuments: (limit = 100) => wait(documents.slice(0, limit), 500),
  searchDocuments: (query: string) => {
    const q = query.toLowerCase();
    return wait(
      documents.filter((d) =>
        [d.category, d.entity, d.original_name, d.document_type, d.document_date].some((v) => v?.toLowerCase().includes(q)),
      ),
      300,
    );
  },
  deleteDocument: (driveFileId: string) => {
    documents = documents.filter((d) => d.drive_file_id !== driveFileId);
    return wait({ success: true }, 600);
  },

  // --- Utils ---
  openExternal: (url: string) => {
    console.info("[mock] openExternal", url);
    return wait({ success: true });
  },
};

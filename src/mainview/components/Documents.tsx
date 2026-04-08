import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import {
  Search,
  FileText,
  Tag,
  Building2,
  Calendar,
  Archive,
  Sparkles,
  Receipt,
  Loader2,
  X,
  FileType,
  FolderTree,
  Brain,
  Banknote,
  Eye,
  ExternalLink,
  Trash2,
  RefreshCw,
  FolderInput,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Assicurazione:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Banca:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Fatture:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Imposte: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Salute: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Lavoro:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  Abitazione:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Veicolo: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  Amministrativo:
    "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  Educazione:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Altro: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, { label: string; icon: typeof Archive }> = {
  pending: { label: "In attesa", icon: FileText },
  classified: { label: "Classificato", icon: Sparkles },
  archived: { label: "Archiviato", icon: Archive },
};

function getDisplayedFilename(doc: any): string {
  const archivedName = doc.archived_filename?.trim();
  if (archivedName) return archivedName;
  return doc.original_name;
}

function formatArchivedLocation(
  archivedPath?: string | null,
  archivedFilename?: string | null,
): string {
  const normalizedPath = (archivedPath ?? "").replace(/\/+$/, "");
  const normalizedFilename = (archivedFilename ?? "").replace(/^\/+/, "");
  if (!normalizedPath) return normalizedFilename;
  if (!normalizedFilename) return normalizedPath;
  return `${normalizedPath}/${normalizedFilename}`;
}

/** Show rearchive button when there's a filing strategy AND either
 *  the doc is not archived or the archived location differs from suggestion. */
function shouldShowRearchive(doc: any): boolean {
  let classification: any = null;
  try {
    classification = doc.classification_json ? JSON.parse(doc.classification_json) : null;
  } catch { return false; }
  const filing = classification?.filing_strategy;
  if (!filing?.full_suggested_path || !filing?.suggested_filename) return false;

  // Already archived at the exact suggested location → hide
  if (doc.archived_path || doc.archived_filename) {
    const currentPath = (doc.archived_path ?? "").replace(/\/+$/, "");
    const suggestedPath = (filing.full_suggested_path ?? "").replace(/\/+$/, "");
    if (currentPath !== suggestedPath) return true;

    // Compare filenames ignoring extension (archiveFile may append source ext)
    const stripExt = (f: string) => f.replace(/\.[^.]+$/, "");
    const currentBase = stripExt((doc.archived_filename ?? "").replace(/^\/+/, ""));
    const suggestedBase = stripExt((filing.suggested_filename ?? "").replace(/^\/+/, ""));
    if (currentBase === suggestedBase) return false;
  }

  return true;
}

export function Documents() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    fileId: string;
    mimeType: string;
    name: string;
  } | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reanalyzingFiles, setReanalyzingFiles] = useState<Set<string>>(
    new Set(),
  );
  const [rearchivingFiles, setRearchivingFiles] = useState<Set<string>>(
    new Set(),
  );

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (e) {
      console.error("Failed to load documents:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout) clearTimeout(searchTimeout);

    if (!query.trim()) {
      loadDocuments();
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.searchDocuments(query);
        setDocuments(results);
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setLoading(false);
      }
    }, 300);

    setSearchTimeout(timeout);
  };

  const handlePreview = async (doc: any) => {
    const mimeType = doc.mime_type ?? "application/octet-stream";
    setPreviewFile({
      fileId: doc.drive_file_id,
      mimeType,
      name: getDisplayedFilename(doc),
    });
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const result = await api.getFilePreview(doc.drive_file_id, mimeType);
      setPreviewData(result?.dataUrl ?? null);
    } catch (e) {
      console.error("Preview failed:", e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenInDrive = (driveFileId: string) => {
    api.openExternal(`https://drive.google.com/file/d/${driveFileId}/view`);
  };

  const handleDelete = async (driveFileId: string, deleteDrive: boolean) => {
    setDeleting(true);
    try {
      await api.deleteDocument(driveFileId, deleteDrive);
      setDocuments((prev) =>
        prev.filter((d) => d.drive_file_id !== driveFileId),
      );
      setDeleteTarget(null);
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleting(false);
    }
  };

  const handleReanalyze = async (doc: any) => {
    setReanalyzingFiles((prev) => new Set(prev).add(doc.drive_file_id));
    try {
      const result = await api.classifyFile(doc.drive_file_id);
      if (result.success) {
        loadDocuments();
      }
    } catch (e) {
      console.error("Re-analyze failed:", e);
    } finally {
      setReanalyzingFiles((prev) => {
        const next = new Set(prev);
        next.delete(doc.drive_file_id);
        return next;
      });
    }
  };

  const handleRearchive = async (doc: any) => {
    const classification = doc.classification_json
      ? (() => { try { return JSON.parse(doc.classification_json); } catch { return null; } })()
      : null;
    const filing = classification?.filing_strategy;
    if (!filing?.full_suggested_path || !filing?.suggested_filename) {
      console.error("No filing strategy available");
      return;
    }
    setRearchivingFiles((prev) => new Set(prev).add(doc.drive_file_id));
    try {
      const result = await api.archiveFile(
        doc.drive_file_id,
        filing.full_suggested_path,
        filing.suggested_filename,
      );
      if (result.success) {
        loadDocuments();
      }
    } catch (e) {
      console.error("Re-archive failed:", e);
    } finally {
      setRearchivingFiles((prev) => {
        const next = new Set(prev);
        next.delete(doc.drive_file_id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Documenti</h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Cerca documenti per categoria, ente, data..."
          className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Documents list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <FileText className="mb-3 size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {searchQuery
              ? "Nessun documento trovato"
              : "Nessun documento analizzato"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const categoryColor =
              CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.Altro;
            const statusInfo =
              STATUS_LABELS[doc.status] ?? STATUS_LABELS.pending;
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={doc.id}
                className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {getDisplayedFilename(doc)}
                      </p>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          doc.status === "archived"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : doc.status === "classified"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}>
                        <StatusIcon className="size-3" />
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {doc.category && (
                        <span className="flex items-center gap-1">
                          <Tag className="size-3" />
                          <span
                            className={`rounded-full px-1.5 py-0.5 ${categoryColor}`}>
                            {doc.category}
                          </span>
                        </span>
                      )}
                      {doc.entity && (
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3" />
                          {doc.entity}
                        </span>
                      )}
                      {doc.document_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {doc.document_date}
                        </span>
                      )}
                      {doc.is_tax_relevant === 1 && (
                        <span className="flex items-center gap-1 text-yellow-600">
                          <Receipt className="size-3" />
                          Imposte
                        </span>
                      )}
                    </div>

                    {doc.archived_path && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {formatArchivedLocation(
                          doc.archived_path,
                          doc.archived_filename,
                        )}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handlePreview(doc)}
                      title="Anteprima">
                      <Eye className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleOpenInDrive(doc.drive_file_id)}
                      title="Apri in Google Drive">
                      <ExternalLink className="size-3.5" />
                    </Button>
                    {doc.classification_json && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setSelectedDoc(doc)}
                        title="Vedi dati analizzati">
                        <Sparkles className="size-3.5 text-blue-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleReanalyze(doc)}
                      disabled={reanalyzingFiles.has(doc.drive_file_id)}
                      title="Ri-analizza">
                      {reanalyzingFiles.has(doc.drive_file_id) ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                    </Button>
                    {shouldShowRearchive(doc) && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRearchive(doc)}
                        disabled={rearchivingFiles.has(doc.drive_file_id)}
                        title="Riarchivia (sposta e rinomina)">
                        {rearchivingFiles.has(doc.drive_file_id) ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <FolderInput className="size-3.5 text-green-600" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteTarget(doc)}
                      title="Elimina">
                      <Trash2 className="size-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 flex h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="truncate text-sm font-medium">
                {previewFile.name}
              </h3>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setPreviewFile(null);
                  setPreviewData(null);
                }}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : previewData ? (
                previewFile.mimeType.startsWith("image/") ? (
                  <img
                    src={previewData}
                    alt={previewFile.name}
                    className="mx-auto max-h-full max-w-full object-contain"
                  />
                ) : previewFile.mimeType === "application/pdf" ? (
                  <iframe
                    src={previewData}
                    className="h-full w-full rounded border"
                    title={previewFile.name}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Anteprima non disponibile per questo tipo di file
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Impossibile caricare l&apos;anteprima
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Dialog */}
      {selectedDoc && (
        <DocumentDetailDialog
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={(doc: any) => {
            setSelectedDoc(null);
            setDeleteTarget(doc);
          }}
          onReanalyze={(doc: any) => {
            setSelectedDoc(null);
            handleReanalyze(doc);
          }}
          onRearchive={(doc: any) => {
            setSelectedDoc(null);
            handleRearchive(doc);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            className="mx-4 w-full max-w-md rounded-xl bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-medium">Elimina documento</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {getDisplayedFilename(deleteTarget)}
              </p>
            </div>
            <div className="space-y-2 p-4">
              <p className="text-sm text-muted-foreground">
                Come vuoi procedere con l&apos;eliminazione?
              </p>
              <div className="space-y-2 pt-2">
                <button
                  onClick={() =>
                    handleDelete(deleteTarget.drive_file_id, false)
                  }
                  disabled={deleting}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50">
                  <Trash2 className="size-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      Elimina solo dal database locale
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Il file resta su Google Drive
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget.drive_file_id, true)}
                  disabled={deleting}
                  className="flex w-full items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm hover:bg-red-100 transition-colors dark:border-red-900/50 dark:bg-red-900/20 dark:hover:bg-red-900/30 disabled:opacity-50">
                  <Trash2 className="size-4 text-red-500" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      Elimina anche da Google Drive
                    </p>
                    <p className="text-xs text-red-600/70 dark:text-red-400/70">
                      Eliminazione permanente
                    </p>
                  </div>
                </button>
              </div>
            </div>
            <div className="border-t border-border px-4 py-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="w-full rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50">
                {deleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Eliminazione in corso...
                  </span>
                ) : (
                  "Annulla"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentDetailDialog({
  doc,
  onClose,
  onDelete,
  onReanalyze,
  onRearchive,
}: {
  doc: any;
  onClose: () => void;
  onDelete: (doc: any) => void;
  onReanalyze: (doc: any) => void;
  onRearchive: (doc: any) => void;
}) {
  const classification = doc.classification_json
    ? (() => {
        try {
          return JSON.parse(doc.classification_json);
        } catch {
          return null;
        }
      })()
    : null;

  const profile = classification?.document_profile;
  const filing = classification?.filing_strategy;
  const financial = classification?.extracted_data?.financial;
  const analysis = classification?.ai_analysis;

  const categoryColor =
    CATEGORY_COLORS[profile?.category ?? doc.category] ?? CATEGORY_COLORS.Altro;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}>
      <div
        className="mx-4 w-full max-w-lg rounded-xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium">Dettaglio Documento</h3>
            <p className="truncate text-xs text-muted-foreground">
              {getDisplayedFilename(doc)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {/* Document Profile */}
          <section>
            <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Profilo Documento
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Categoria:
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor}`}>
                  {profile?.category ?? doc.category ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ente:</span>
                <span className="text-sm">
                  {profile?.entity ?? doc.entity ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileType className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tipo:</span>
                <span className="text-sm">
                  {profile?.document_type ?? doc.document_type ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Data:</span>
                <span className="text-sm">
                  {profile?.document_date ?? doc.document_date ?? "—"}
                </span>
              </div>
              {profile?.is_tax_relevant && (
                <div className="flex items-center gap-2">
                  <Receipt className="size-3.5 text-muted-foreground" />
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Imposte
                  </span>
                  {profile?.tax_notes && (
                    <span className="text-xs text-muted-foreground">
                      {profile?.tax_notes ?? doc.tax_notes}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Filing Strategy */}
          {filing && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Strategia di Archiviazione
              </h4>
              <div className="space-y-2 rounded-md bg-muted/50 p-3">
                <div className="flex items-start gap-2">
                  <FolderTree className="mt-0.5 size-3.5 text-muted-foreground" />
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Percorso:
                    </span>
                    <p className="font-mono text-sm">
                      {filing.full_suggested_path}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-3.5 text-muted-foreground" />
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Nome file:
                    </span>
                    <p className="font-mono text-sm">
                      {filing.suggested_filename}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Archived Path */}
          {doc.archived_path && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Archiviazione
              </h4>
              <div className="rounded-md bg-green-50 p-3 dark:bg-green-900/20">
                <div className="flex items-center gap-2">
                  <Archive className="size-3.5 text-green-600 dark:text-green-400" />
                  <span className="font-mono text-sm text-green-700 dark:text-green-400">
                    {formatArchivedLocation(
                      doc.archived_path,
                      doc.archived_filename,
                    )}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Financial Data */}
          {financial && financial !== false && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Dati Finanziari
              </h4>
              <div className="space-y-1.5">
                {financial.amount != null && (
                  <div className="flex items-center gap-2">
                    <Banknote className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {financial.currency} {financial.amount?.toFixed(2)}
                    </span>
                    {financial.is_paid != null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          financial.is_paid
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                        {financial.is_paid ? "Pagato" : "Non pagato"}
                      </span>
                    )}
                  </div>
                )}
                {financial.is_invoice && (
                  <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    Fattura
                  </span>
                )}
              </div>
            </section>
          )}

          {/* AI Analysis */}
          {analysis && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Analisi AI
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Brain className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Confidenza:
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          analysis.confidence_score > 0.8
                            ? "bg-green-500"
                            : analysis.confidence_score > 0.5
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{
                          width: `${(analysis.confidence_score * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium">
                    {(analysis.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
                {analysis.needs_human_validation && (
                  <p className="rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                    Richiede validazione umana
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {analysis.reasoning}
                </p>
              </div>
            </section>
          )}

          {/* No classification data fallback */}
          {!classification && (
            <div className="flex flex-col items-center py-6 text-center">
              <FileText className="mb-2 size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Nessun dato di classificazione disponibile
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <button
            onClick={() => onReanalyze(doc)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
            <RefreshCw className="size-3.5" />
            Ri-analizza
          </button>
          {shouldShowRearchive(doc) && (
            <button
              onClick={() => onRearchive(doc)}
              className="flex items-center gap-1.5 rounded-md border border-green-200 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 transition-colors dark:border-green-900/50 dark:text-green-400 dark:hover:bg-green-900/20">
              <FolderInput className="size-3.5" />
              Riarchivia
            </button>
          )}
          <button
            onClick={() => onDelete(doc)}
            className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
            <Trash2 className="size-3.5" />
            Elimina
          </button>
          <button
            onClick={onClose}
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

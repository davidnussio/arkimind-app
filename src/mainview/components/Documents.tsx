import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { CATEGORY_COLORS } from "@/lib/constants";
import { PreviewModal } from "./PreviewModal";
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
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { useToast } from "./Toaster";

const STATUS_LABELS: Record<string, { label: string; icon: typeof Archive }> = {
  pending: { label: "In attesa", icon: FileText },
  classified: { label: "Classificato", icon: Sparkles },
  archived: { label: "Archiviato", icon: Archive },
};

const PAGE_SIZE = 20;

function getDisplayedFilename(doc: any): string {
  const archivedName = doc.archived_filename?.trim();
  if (archivedName) return archivedName;
  return doc.original_name;
}

function formatArchivedLocation(archivedPath?: string | null, archivedFilename?: string | null): string {
  const normalizedPath = (archivedPath ?? "").replace(/\/+$/, "");
  const normalizedFilename = (archivedFilename ?? "").replace(/^\/+/, "");
  if (!normalizedPath) return normalizedFilename;
  if (!normalizedFilename) return normalizedPath;
  return `${normalizedPath}/${normalizedFilename}`;
}

function shouldShowRearchive(doc: any): boolean {
  let classification: any = null;
  try {
    classification = doc.classification_json ? JSON.parse(doc.classification_json) : null;
  } catch { return false; }
  const filing = classification?.filing_strategy;
  if (!filing?.full_suggested_path || !filing?.suggested_filename) return false;
  if (doc.archived_path || doc.archived_filename) {
    const currentPath = (doc.archived_path ?? "").replace(/\/+$/, "");
    const suggestedPath = (filing.full_suggested_path ?? "").replace(/\/+$/, "");
    if (currentPath !== suggestedPath) return true;
    const stripExt = (f: string) => f.replace(/\.[^.]+$/, "");
    const currentBase = stripExt((doc.archived_filename ?? "").replace(/^\/+/, ""));
    const suggestedBase = stripExt((filing.suggested_filename ?? "").replace(/^\/+/, ""));
    if (currentBase === suggestedBase) return false;
  }
  return true;
}

export function Documents() {
  const { toastError } = useToast();
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [previewFile, setPreviewFile] = useState<{ fileId: string; mimeType: string; name: string } | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reanalyzingFiles, setReanalyzingFiles] = useState<Set<string>>(new Set());
  const [rearchivingFiles, setRearchivingFiles] = useState<Set<string>>(new Set());
  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterTaxRelevant, setFilterTaxRelevant] = useState<boolean | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await api.getDocuments();
      setAllDocuments(docs);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    if (searchTimeout) clearTimeout(searchTimeout);
    if (!query.trim()) {
      loadDocuments();
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.searchDocuments(query);
        setAllDocuments(results);
      } catch (e) {
        toastError(e);
      } finally {
        setLoading(false);
      }
    }, 300);
    setSearchTimeout(timeout);
  };

  // Apply client-side filters
  const filteredDocuments = allDocuments.filter((doc) => {
    if (filterCategory && doc.category !== filterCategory) return false;
    if (filterStatus && doc.status !== filterStatus) return false;
    if (filterTaxRelevant !== null && (doc.is_tax_relevant === 1) !== filterTaxRelevant) return false;
    return true;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const paginatedDocuments = filteredDocuments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handlePreview = async (doc: any) => {
    const mimeType = doc.mime_type ?? "application/octet-stream";
    setPreviewFile({ fileId: doc.drive_file_id, mimeType, name: getDisplayedFilename(doc) });
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const result = await api.getFilePreview(doc.drive_file_id, mimeType);
      setPreviewData(result?.dataUrl ?? null);
    } catch (e) {
      toastError(e);
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
      setAllDocuments((prev) => prev.filter((d) => d.drive_file_id !== driveFileId));
      setDeleteTarget(null);
    } catch (e) {
      toastError(e);
    } finally {
      setDeleting(false);
    }
  };

  const handleReanalyze = async (doc: any) => {
    setReanalyzingFiles((prev) => new Set(prev).add(doc.drive_file_id));
    try {
      const result = await api.classifyFile(doc.drive_file_id);
      if (result.success) loadDocuments();
    } catch (e) {
      toastError(e);
    } finally {
      setReanalyzingFiles((prev) => { const next = new Set(prev); next.delete(doc.drive_file_id); return next; });
    }
  };

  const handleRearchive = async (doc: any) => {
    const classification = doc.classification_json
      ? (() => { try { return JSON.parse(doc.classification_json); } catch { return null; } })()
      : null;
    const filing = classification?.filing_strategy;
    if (!filing?.full_suggested_path || !filing?.suggested_filename) return;
    setRearchivingFiles((prev) => new Set(prev).add(doc.drive_file_id));
    try {
      const result = await api.archiveFile(doc.drive_file_id, filing.full_suggested_path, filing.suggested_filename);
      if (result.success) loadDocuments();
    } catch (e) {
      toastError(e);
    } finally {
      setRearchivingFiles((prev) => { const next = new Set(prev); next.delete(doc.drive_file_id); return next; });
    }
  };

  const clearFilters = () => {
    setFilterCategory("");
    setFilterStatus("");
    setFilterTaxRelevant(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = filterCategory || filterStatus || filterTaxRelevant !== null;

  // Get unique categories from documents for filter dropdown
  const availableCategories = [...new Set(allDocuments.map((d) => d.category).filter(Boolean))].sort();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Documenti</h2>

      {/* Search + Filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cerca documenti... (⌘K)"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="default"
          onClick={() => setShowFilters((f) => !f)}
          title="Filtri avanzati"
        >
          <Filter className="size-4" />
          {hasActiveFilters && <span className="size-1.5 rounded-full bg-primary" />}
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Categoria</label>
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-ring"
            >
              <option value="">Tutte</option>
              {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Stato</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-ring"
            >
              <option value="">Tutti</option>
              <option value="pending">In attesa</option>
              <option value="classified">Classificato</option>
              <option value="archived">Archiviato</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Rilevanza fiscale</label>
            <select
              value={filterTaxRelevant === null ? "" : filterTaxRelevant ? "yes" : "no"}
              onChange={(e) => {
                const v = e.target.value;
                setFilterTaxRelevant(v === "" ? null : v === "yes");
                setCurrentPage(1);
              }}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-ring"
            >
              <option value="">Tutti</option>
              <option value="yes">Sì</option>
              <option value="no">No</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-4 text-xs text-muted-foreground underline hover:text-foreground">
              Rimuovi filtri
            </button>
          )}
          <span className="ml-auto mt-4 text-xs text-muted-foreground">
            {filteredDocuments.length} risultati
          </span>
        </div>
      )}

      {/* Documents list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : paginatedDocuments.length === 0 ? (
        <EmptyState
          illustration={searchQuery || hasActiveFilters ? "search" : "document"}
          title={searchQuery || hasActiveFilters ? "Nessun documento trovato" : "Nessun documento analizzato"}
          description={searchQuery || hasActiveFilters ? "Prova a modificare i termini di ricerca o i filtri." : "Analizza i file dalla Dashboard per vederli qui."}
        />
      ) : (
        <div className="space-y-2">
          {paginatedDocuments.map((doc) => {
            const categoryColor = CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.Altro;
            const statusInfo = STATUS_LABELS[doc.status] ?? STATUS_LABELS.pending;
            const StatusIcon = statusInfo.icon;

            return (
              <div key={doc.id} className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{getDisplayedFilename(doc)}</p>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
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
                          <span className={`rounded-full px-1.5 py-0.5 ${categoryColor}`}>{doc.category}</span>
                        </span>
                      )}
                      {doc.entity && (
                        <span className="flex items-center gap-1"><Building2 className="size-3" />{doc.entity}</span>
                      )}
                      {doc.document_date && (
                        <span className="flex items-center gap-1"><Calendar className="size-3" />{doc.document_date}</span>
                      )}
                      {doc.is_tax_relevant === 1 && (
                        <span className="flex items-center gap-1 text-yellow-600"><Receipt className="size-3" />Imposte</span>
                      )}
                    </div>
                    {doc.archived_path && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {formatArchivedLocation(doc.archived_path, doc.archived_filename)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-xs" onClick={() => handlePreview(doc)} title="Anteprima">
                      <Eye className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => handleOpenInDrive(doc.drive_file_id)} title="Apri in Google Drive">
                      <ExternalLink className="size-3.5" />
                    </Button>
                    {doc.classification_json && (
                      <Button variant="ghost" size="icon-xs" onClick={() => setSelectedDoc(doc)} title="Vedi dati analizzati">
                        <Sparkles className="size-3.5 text-blue-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-xs" onClick={() => handleReanalyze(doc)}
                      disabled={reanalyzingFiles.has(doc.drive_file_id)} title="Ri-analizza">
                      {reanalyzingFiles.has(doc.drive_file_id) ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    </Button>
                    {shouldShowRearchive(doc) && (
                      <Button variant="ghost" size="icon-xs" onClick={() => handleRearchive(doc)}
                        disabled={rearchivingFiles.has(doc.drive_file_id)} title="Riarchivia">
                        {rearchivingFiles.has(doc.drive_file_id) ? <Loader2 className="size-3.5 animate-spin" /> : <FolderInput className="size-3.5 text-green-600" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-xs" onClick={() => setDeleteTarget(doc)} title="Elimina">
                      <Trash2 className="size-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="icon-xs" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Pagina {currentPage} di {totalPages}
          </span>
          <Button variant="outline" size="icon-xs" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <PreviewModal
          name={previewFile.name}
          mimeType={previewFile.mimeType}
          dataUrl={previewData}
          loading={previewLoading}
          onClose={() => { setPreviewFile(null); setPreviewData(null); }}
        />
      )}

      {/* Document Detail Dialog */}
      {selectedDoc && (
        <DocumentDetailDialog
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={(doc: any) => { setSelectedDoc(null); setDeleteTarget(doc); }}
          onReanalyze={(doc: any) => { setSelectedDoc(null); handleReanalyze(doc); }}
          onRearchive={(doc: any) => { setSelectedDoc(null); handleRearchive(doc); }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && <DeleteDialog target={deleteTarget} deleting={deleting} onDelete={handleDelete} onClose={() => !deleting && setDeleteTarget(null)} />}
    </div>
  );
}

function DeleteDialog({ target, deleting, onDelete, onClose }: {
  target: any; deleting: boolean;
  onDelete: (driveFileId: string, deleteDrive: boolean) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, deleting]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => !deleting && onClose()}>
      <div className="mx-4 w-full max-w-md rounded-xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">Elimina documento</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">{getDisplayedFilename(target)}</p>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-sm text-muted-foreground">Come vuoi procedere con l'eliminazione?</p>
          <div className="space-y-2 pt-2">
            <button onClick={() => onDelete(target.drive_file_id, false)} disabled={deleting}
              className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50">
              <Trash2 className="size-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Elimina solo dal database locale</p>
                <p className="text-xs text-muted-foreground">Il file resta su Google Drive</p>
              </div>
            </button>
            <button onClick={() => onDelete(target.drive_file_id, true)} disabled={deleting}
              className="flex w-full items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm hover:bg-red-100 transition-colors dark:border-red-900/50 dark:bg-red-900/20 dark:hover:bg-red-900/30 disabled:opacity-50">
              <Trash2 className="size-4 text-red-500" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">Elimina anche da Google Drive</p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70">Eliminazione permanente</p>
              </div>
            </button>
          </div>
        </div>
        <div className="border-t border-border px-4 py-3">
          <button onClick={onClose} disabled={deleting}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50">
            {deleting ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="size-3.5 animate-spin" />Eliminazione in corso...</span>
            ) : "Annulla"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentDetailDialog({ doc, onClose, onDelete, onReanalyze, onRearchive }: {
  doc: any; onClose: () => void;
  onDelete: (doc: any) => void; onReanalyze: (doc: any) => void; onRearchive: (doc: any) => void;
}) {
  const classification = doc.classification_json
    ? (() => { try { return JSON.parse(doc.classification_json); } catch { return null; } })()
    : null;
  const profile = classification?.document_profile;
  const filing = classification?.filing_strategy;
  const financial = classification?.extracted_data?.financial;
  const analysis = classification?.ai_analysis;
  const categoryColor = CATEGORY_COLORS[profile?.category ?? doc.category] ?? CATEGORY_COLORS.Altro;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium">Dettaglio Documento</h3>
            <p className="truncate text-xs text-muted-foreground">{getDisplayedFilename(doc)}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          <section>
            <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Profilo Documento</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Categoria:</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor}`}>{profile?.category ?? doc.category ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ente:</span>
                <span className="text-sm">{profile?.entity ?? doc.entity ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileType className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tipo:</span>
                <span className="text-sm">{profile?.document_type ?? doc.document_type ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Data:</span>
                <span className="text-sm">{profile?.document_date ?? doc.document_date ?? "—"}</span>
              </div>
              {profile?.is_tax_relevant && (
                <div className="flex items-center gap-2">
                  <Receipt className="size-3.5 text-muted-foreground" />
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Imposte</span>
                  {profile?.tax_notes && <span className="text-xs text-muted-foreground">{profile?.tax_notes}</span>}
                </div>
              )}
            </div>
          </section>
          {filing && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Strategia di Archiviazione</h4>
              <div className="space-y-2 rounded-md bg-muted/50 p-3">
                <div className="flex items-start gap-2">
                  <FolderTree className="mt-0.5 size-3.5 text-muted-foreground" />
                  <div><span className="text-xs text-muted-foreground">Percorso:</span><p className="font-mono text-sm">{filing.full_suggested_path}</p></div>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-3.5 text-muted-foreground" />
                  <div><span className="text-xs text-muted-foreground">Nome file:</span><p className="font-mono text-sm">{filing.suggested_filename}</p></div>
                </div>
              </div>
            </section>
          )}
          {doc.archived_path && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Archiviazione</h4>
              <div className="rounded-md bg-green-50 p-3 dark:bg-green-900/20">
                <div className="flex items-center gap-2">
                  <Archive className="size-3.5 text-green-600 dark:text-green-400" />
                  <span className="font-mono text-sm text-green-700 dark:text-green-400">
                    {formatArchivedLocation(doc.archived_path, doc.archived_filename)}
                  </span>
                </div>
              </div>
            </section>
          )}
          {financial && financial !== false && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Dati Finanziari</h4>
              <div className="space-y-1.5">
                {financial.amount != null && (
                  <div className="flex items-center gap-2">
                    <Banknote className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{financial.currency} {financial.amount?.toFixed(2)}</span>
                    {financial.is_paid != null && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${financial.is_paid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                        {financial.is_paid ? "Pagato" : "Non pagato"}
                      </span>
                    )}
                  </div>
                )}
                {financial.is_invoice && (
                  <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Fattura</span>
                )}
              </div>
            </section>
          )}
          {analysis && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Analisi AI</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Brain className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Confidenza:</span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${analysis.confidence_score > 0.8 ? "bg-green-500" : analysis.confidence_score > 0.5 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${(analysis.confidence_score * 100).toFixed(0)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-medium">{(analysis.confidence_score * 100).toFixed(0)}%</span>
                </div>
                {analysis.needs_human_validation && (
                  <p className="rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">Richiede validazione umana</p>
                )}
                <p className="text-xs text-muted-foreground">{analysis.reasoning}</p>
              </div>
            </section>
          )}
          {!classification && (
            <div className="flex flex-col items-center py-6 text-center">
              <FileText className="mb-2 size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nessun dato di classificazione disponibile</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <button onClick={() => onReanalyze(doc)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
            <RefreshCw className="size-3.5" />Ri-analizza
          </button>
          {shouldShowRearchive(doc) && (
            <button onClick={() => onRearchive(doc)} className="flex items-center gap-1.5 rounded-md border border-green-200 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 transition-colors dark:border-green-900/50 dark:text-green-400 dark:hover:bg-green-900/20">
              <FolderInput className="size-3.5" />Riarchivia
            </button>
          )}
          <button onClick={() => onDelete(doc)} className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
            <Trash2 className="size-3.5" />Elimina
          </button>
          <button onClick={onClose} className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors">Chiudi</button>
        </div>
      </div>
    </div>
  );
}

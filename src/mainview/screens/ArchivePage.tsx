import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  ExternalLink,
  Eye,
  Folder,
  ListChecks,
  Loader2,
  MoreHorizontal,
  PanelRightOpen,
  Receipt,
  RefreshCw,
  Repeat,
  Search,
  SearchX,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Select } from "@/components/ui/input";
import { Callout, Kbd, Segmented, Skeleton } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout";
import { CategoryBadge, FileIcon, StatusBadge } from "@/components/badges";
import { EmptyState } from "@/components/EmptyState";
import { DetailPanel } from "@/components/DetailPanel";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ConfirmDialog";
import { DeleteDocumentDialog } from "@/components/DeleteDocumentDialog";
import { useToast } from "@/components/Toaster";
import { api } from "@/lib/api";
import { SKIPPED, type ActivityController } from "@/hooks/use-activity";
import {
  archivedLocation,
  canPreview,
  destinationOf,
  displayName,
  driveFileUrl,
  needsRearchive,
  parseClassification,
  stageOf,
  type Destination,
} from "@/lib/documents";
import { formatDate, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DocumentRecord } from "../../shared/types";

const PAGE_SIZE = 25;
/** `getDocuments` returns the most recently updated rows up to this limit. */
const LOAD_LIMIT = 1000;
/** The DB search returns at most this many rows. */
const SEARCH_LIMIT = 50;

type StatusFilter = "all" | "archived" | "analyzed";

interface ArchivePageProps {
  activity: ActivityController;
  authenticated: boolean | null;
  signingIn: boolean;
  onSignIn: () => void;
  onPreview: (fileId: string, mimeType: string | null | undefined, name: string) => void;
  /** Bumped by ⌘R. */
  refreshSignal: number;
  /** Bumped by ⌘K. */
  focusSearchSignal: number;
}

export function ArchivePage({
  activity,
  authenticated,
  signingIn,
  onSignIn,
  onPreview,
  refreshSignal,
  focusSearchSignal,
}: ArchivePageProps) {
  const { toast, toastError } = useToast();
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("");
  const [taxOnly, setTaxOnly] = useState(false);
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<Record<string, "reanalyze" | "move">>({});
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoadError(null);
    try {
      const q = query.trim();
      const rows = q ? await api.searchDocuments(q) : await api.getDocuments(LOAD_LIMIT);
      if (seq === loadSeq.current) setDocs(rows);
    } catch (e) {
      if (seq === loadSeq.current) setLoadError((e as Error)?.message ?? String(e));
    }
  }, [query]);

  // Debounced (re)load on search changes and on ⌘R.
  useEffect(() => {
    const t = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, query, refreshSignal]);

  useEffect(() => {
    if (focusSearchSignal) {
      searchRef.current?.focus();
      searchRef.current?.select();
    }
  }, [focusSearchSignal]);

  useEffect(() => setPage(1), [query, status, category, taxOnly, recurringOnly]);

  const categories = useMemo(
    () => [...new Set((docs ?? []).map((d) => d.category).filter((c): c is string => Boolean(c)))].sort(),
    [docs],
  );

  const filtered = useMemo(
    () =>
      (docs ?? []).filter((d) => {
        if (status === "archived" && d.status !== "archived") return false;
        if (status === "analyzed" && d.status === "archived") return false;
        if (category && d.category !== category) return false;
        if (taxOnly && d.is_tax_relevant !== 1) return false;
        if (recurringOnly && d.is_recurring !== 1) return false;
        return true;
      }),
    [docs, status, category, taxOnly, recurringOnly],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = status !== "all" || Boolean(category) || taxOnly || recurringOnly;
  const selected = docs?.find((d) => d.drive_file_id === selectedId) ?? null;

  const clearFilters = () => {
    setStatus("all");
    setCategory("");
    setTaxOnly(false);
    setRecurringOnly(false);
  };

  // --- Single-document actions ---

  const withBusy = async (id: string, op: "reanalyze" | "move", task: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [id]: op }));
    try {
      await task();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy((b) => {
        const { [id]: _done, ...rest } = b;
        return rest;
      });
    }
  };

  const reanalyze = (doc: DocumentRecord) =>
    withBusy(doc.drive_file_id, "reanalyze", async () => {
      const result = await api.classifyFile(doc.drive_file_id);
      if (!result.success) throw new Error(result.error ?? "Analisi non riuscita");
      await load();
      toast(`Analisi di «${displayName(doc)}» aggiornata`, "success");
    });

  const move = (doc: DocumentRecord, destination: Destination) =>
    withBusy(doc.drive_file_id, "move", async () => {
      await api.archiveFile(doc.drive_file_id, destination.path, destination.filename);
      await load();
      toast(`Archiviato in ${destination.path}`, "success");
    });

  const remove = async (deleteFromDrive: boolean) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteDocument(deleteTarget.drive_file_id, deleteFromDrive);
      setDocs((prev) => prev?.filter((d) => d.drive_file_id !== deleteTarget.drive_file_id) ?? prev);
      if (selectedId === deleteTarget.drive_file_id) setSelectedId(null);
      toast(deleteFromDrive ? "Documento eliminato da Google Drive" : "Documento rimosso da Arkimind", "success");
      setDeleteTarget(null);
    } catch (e) {
      toastError(e);
    } finally {
      setDeleting(false);
    }
  };

  // --- Bulk actions on the filtered list ---

  const toReanalyze = filtered.filter((d) => d.status !== "pending" || d.classification_json);
  const toMove = filtered.filter(needsRearchive);
  const toArchive = filtered.filter((d) => d.status !== "archived");

  const startBulk = (
    items: DocumentRecord[],
    request: Omit<ConfirmRequest, "onConfirm">,
    title: string,
    worker: (doc: DocumentRecord, isCancelled: () => boolean) => Promise<void | typeof SKIPPED>,
  ) =>
    setConfirm({
      ...request,
      onConfirm: async () => {
        setConfirm(null);
        const entries = items.map((d) => ({ id: d.drive_file_id, name: displayName(d), doc: d }));
        await activity.run("batch", title, entries, (e, isCancelled) => worker(e.doc, isCancelled));
        await load();
      },
    });

  const bulkReanalyze = () =>
    startBulk(
      toReanalyze,
      {
        title: `Ri-analizzare ${plural(toReanalyze.length, "documento", "documenti")}?`,
        description: "Ogni documento viene scaricato da Drive e inviato di nuovo al servizio di analisi. I file non vengono spostati.",
        confirmLabel: "Ri-analizza",
      },
      `Nuova analisi di ${plural(toReanalyze.length, "documento", "documenti")}`,
      async (doc) => {
        const r = await api.classifyFile(doc.drive_file_id);
        if (!r.success) throw new Error(r.error ?? "Analisi non riuscita");
      },
    );

  const bulkMove = () =>
    startBulk(
      toMove,
      {
        title: `Spostare ${plural(toMove.length, "documento", "documenti")}?`,
        description: "Questi documenti verranno spostati nella posizione suggerita dall'ultima analisi.",
        confirmLabel: "Sposta",
      },
      `Spostamento di ${plural(toMove.length, "documento", "documenti")}`,
      async (doc) => {
        const dest = destinationOf(parseClassification(doc.classification_json));
        if (!dest) throw new Error("Dati di archiviazione mancanti");
        await api.archiveFile(doc.drive_file_id, dest.path, dest.filename);
      },
    );

  const bulkAnalyzeAndArchive = () =>
    startBulk(
      toArchive,
      {
        title: `Archiviare ${plural(toArchive.length, "documento", "documenti")}?`,
        description:
          "I documenti non ancora archiviati verranno analizzati (se serve) e spostati nella cartella proposta, senza revisione.",
        confirmLabel: "Analizza e archivia",
      },
      `Archiviazione di ${plural(toArchive.length, "documento", "documenti")}`,
      async (doc, isCancelled) => {
        let dest = doc.status === "pending" ? null : destinationOf(parseClassification(doc.classification_json));
        if (!dest) {
          const r = await api.classifyFile(doc.drive_file_id);
          if (!r.success || !r.classification) throw new Error(r.error ?? "Analisi non riuscita");
          dest = destinationOf(r.classification);
          if (!dest) throw new Error("Dati di archiviazione mancanti");
        }
        if (isCancelled()) return SKIPPED;
        await api.archiveFile(doc.drive_file_id, dest.path, dest.filename);
      },
    );

  // --- Render ---

  const archivedCount = docs?.filter((d) => d.status === "archived").length ?? 0;
  const description = docs
    ? query.trim()
      ? `${plural(docs.length, "risultato", "risultati")} per «${query.trim()}»`
      : `${plural(docs.length, "documento", "documenti")} · ${archivedCount} ${archivedCount === 1 ? "archiviato" : "archiviati"}`
    : "Tutti i documenti analizzati da Arkimind.";

  const selectedClassification = selected ? parseClassification(selected.classification_json) : null;
  const selectedOp = selected ? busy[selected.drive_file_id] : undefined;

  return (
    <>
      <PageHeader
        title="Archivio"
        description={description}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!docs || filtered.length === 0 || activity.busy}>
                <ListChecks />
                Azioni sui risultati
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72">
              <DropdownMenuLabel>
                Su {plural(filtered.length, "documento visibile", "documenti visibili")}
              </DropdownMenuLabel>
              <DropdownMenuItem disabled={toReanalyze.length === 0} onSelect={bulkReanalyze}>
                <RefreshCw />
                <span className="flex-1">Ri-analizza</span>
                <span className="text-xs text-muted-foreground tabular-nums">{toReanalyze.length}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={toMove.length === 0} onSelect={bulkMove}>
                <ArrowRightLeft />
                <span className="flex-1">Sposta nelle posizioni suggerite</span>
                <span className="text-xs text-muted-foreground tabular-nums">{toMove.length}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={toArchive.length === 0} onSelect={bulkAnalyzeAndArchive}>
                <Zap />
                <span className="flex-1">Archivia i non archiviati</span>
                <span className="text-xs text-muted-foreground tabular-nums">{toArchive.length}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {authenticated === false && (
        <Callout
          tone="warning"
          icon={CloudOff}
          className="mb-4"
          action={
            <Button size="sm" variant="outline" onClick={onSignIn} disabled={signingIn}>
              {signingIn && <Loader2 className="animate-spin" />}
              Accedi con Google
            </Button>
          }
        >
          Google Drive non è collegato: puoi consultare l'archivio, ma anteprime e operazioni sui file richiedono
          l'accesso.
        </Callout>
      )}

      <div className="@container rounded-2xl border bg-card shadow-xs">
        <div className="space-y-3 border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && query && (e.preventDefault(), setQuery(""))}
              placeholder="Cerca per nome, ente, categoria, tipo o data…"
              aria-label="Cerca nell'archivio"
              className="h-10 bg-background pr-16 pl-9 shadow-none"
            />
            <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1">
              {query ? (
                <IconButton label="Cancella ricerca" icon={X} size="icon-xs" onClick={() => setQuery("")} />
              ) : (
                <>
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<StatusFilter>
              aria-label="Stato"
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "Tutti" },
                { value: "archived", label: "Archiviati" },
                { value: "analyzed", label: "Non archiviati" },
              ]}
            />
            <Select
              aria-label="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-44 [&_select]:h-8"
            >
              <option value="">Tutte le categorie</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <ToggleChip icon={Receipt} label="Fiscali" pressed={taxOnly} onPressedChange={setTaxOnly} />
            <ToggleChip icon={Repeat} label="Ricorrenti" pressed={recurringOnly} onPressedChange={setRecurringOnly} />
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {docs && hasFilters && (
                <>
                  <span className="tabular-nums">{plural(filtered.length, "risultato", "risultati")}</span>
                  <Button variant="link" size="xs" className="px-0" onClick={clearFilters}>
                    Azzera filtri
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {loadError ? (
          <EmptyState
            icon={AlertCircle}
            tone="danger"
            title="Impossibile caricare l'archivio"
            description={loadError}
            action={
              <Button variant="outline" onClick={load}>
                <RefreshCw />
                Riprova
              </Button>
            }
          />
        ) : docs === null ? (
          <div className="divide-y" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-7 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          query || hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Nessun documento trovato"
              description="Prova con altre parole o rimuovi qualche filtro."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    clearFilters();
                  }}
                >
                  Mostra tutto l'archivio
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Archive}
              title="L'archivio è vuoto"
              description="I documenti compaiono qui dopo essere stati analizzati nella sezione «Da archiviare»."
            />
          )
        ) : (
          <>
            <div role="table" aria-label="Documenti">
              <div
                role="row"
                className="grid grid-cols-[minmax(0,1fr)_60px] gap-4 border-b bg-muted/40 px-4 py-2 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase @2xl:grid-cols-[minmax(0,1fr)_9rem_8.5rem_60px] @3xl:grid-cols-[minmax(0,1fr)_9rem_7.5rem_8.5rem_60px]"
              >
                <span role="columnheader">Documento</span>
                <span role="columnheader" className="hidden @2xl:block">
                  Categoria
                </span>
                <span role="columnheader" className="hidden @3xl:block">
                  Data
                </span>
                <span role="columnheader" className="hidden @2xl:block">
                  Stato
                </span>
                <span role="columnheader">
                  <span className="sr-only">Azioni</span>
                </span>
              </div>
              <div className="divide-y">
                {rows.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    busy={busy[doc.drive_file_id]}
                    onOpen={() => setSelectedId(doc.drive_file_id)}
                    onPreview={() => onPreview(doc.drive_file_id, doc.mime_type, displayName(doc))}
                    onReanalyze={() => reanalyze(doc)}
                    onMove={() => {
                      const dest = destinationOf(parseClassification(doc.classification_json));
                      if (dest) move(doc, dest);
                    }}
                    onDelete={() => setDeleteTarget(doc)}
                  />
                ))}
              </div>
            </div>
            <footer className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} di{" "}
                {filtered.length}
                {query.trim() && docs.length >= SEARCH_LIMIT && " · mostrati i primi 50 risultati della ricerca"}
              </span>
              {pageCount > 1 && (
                <div className="flex items-center gap-1">
                  <IconButton
                    label="Pagina precedente"
                    icon={ChevronLeft}
                    size="icon-xs"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  />
                  <span className="px-2 tabular-nums">
                    {currentPage} / {pageCount}
                  </span>
                  <IconButton
                    label="Pagina successiva"
                    icon={ChevronRight}
                    size="icon-xs"
                    variant="outline"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  />
                </div>
              )}
            </footer>
          </>
        )}
      </div>

      {selected && (
        <DetailPanel
          open
          onOpenChange={(open) => !open && setSelectedId(null)}
          fileId={selected.drive_file_id}
          name={displayName(selected)}
          mimeType={selected.mime_type}
          meta={[
            selected.archived_filename && selected.archived_filename !== selected.original_name
              ? `originale: ${selected.original_name}`
              : "",
            `aggiornato il ${formatDate(selected.updated_at.replace(" ", "T").slice(0, 10))}`,
          ].filter(Boolean)}
          status={selected.status}
          classification={selectedClassification}
          currentLocation={
            selected.status === "archived" && selected.archived_path
              ? { path: selected.archived_path, filename: selected.archived_filename ?? "" }
              : null
          }
          editableDestination={selected.status !== "archived"}
          analyzing={selectedOp === "reanalyze"}
          onAnalyze={() => reanalyze(selected)}
          footer={(destination) => {
            const archived = stageOf(selected.status) === "archived";
            const canMove = destination && (!archived || needsRearchive(selected));
            return (
              <>
                <Button
                  variant="outline"
                  onClick={() => onPreview(selected.drive_file_id, selected.mime_type, displayName(selected))}
                  disabled={!canPreview(selected.mime_type)}
                >
                  <Eye />
                  Anteprima
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Altre azioni">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => api.openExternal(driveFileUrl(selected.drive_file_id))}>
                      <ExternalLink />
                      Apri in Google Drive
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => reanalyze(selected)} disabled={Boolean(selectedOp)}>
                      <RefreshCw />
                      Ri-analizza
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(selected)}>
                      <Trash2 />
                      Elimina…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex-1" />
                {canMove && (
                  <Button onClick={() => move(selected, destination)} disabled={Boolean(selectedOp)}>
                    {selectedOp === "move" ? <Loader2 className="animate-spin" /> : archived ? <ArrowRightLeft /> : <Archive />}
                    {archived ? "Sposta nella nuova posizione" : "Archivia"}
                  </Button>
                )}
              </>
            );
          }}
        />
      )}

      {deleteTarget && (
        <DeleteDocumentDialog
          key={deleteTarget.drive_file_id}
          open
          name={displayName(deleteTarget)}
          deleting={deleting}
          onDelete={remove}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function ToggleChip({
  icon: Icon,
  label,
  pressed,
  onPressedChange,
}: {
  icon: typeof Receipt;
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <button
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        pressed
          ? "border-primary/40 bg-accent text-accent-foreground"
          : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-input/20",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function DocumentRow({
  doc,
  busy,
  onOpen,
  onPreview,
  onReanalyze,
  onMove,
  onDelete,
}: {
  doc: DocumentRecord;
  busy: "reanalyze" | "move" | undefined;
  onOpen: () => void;
  onPreview: () => void;
  onReanalyze: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const name = displayName(doc);
  const location = doc.archived_path;
  const moveSuggested = doc.status === "archived" && needsRearchive(doc);

  return (
    <div
      role="row"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button,[role=menuitem]")) onOpen();
      }}
      className="group grid cursor-default grid-cols-[minmax(0,1fr)_60px] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted/40 @2xl:grid-cols-[minmax(0,1fr)_9rem_8.5rem_60px] @3xl:grid-cols-[minmax(0,1fr)_9rem_7.5rem_8.5rem_60px]"
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <FileIcon mimeType={doc.mime_type} name={doc.original_name} size="sm" />
        <div className="min-w-0">
          <button
            onClick={onOpen}
            title={name}
            className="block max-w-full truncate rounded text-left text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            {name}
          </button>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {doc.entity && <span className="shrink-0">{doc.entity}</span>}
            {doc.entity && location && <span aria-hidden>·</span>}
            {location && (
              <span className="flex min-w-0 items-center gap-1" title={archivedLocation(doc)}>
                <Folder className="size-3 shrink-0" />
                <span className="truncate">{location.split("/").join(" › ")}</span>
              </span>
            )}
          </p>
        </div>
      </div>
      <div role="cell" className="hidden min-w-0 @2xl:block">
        <CategoryBadge category={doc.category} />
      </div>
      <div role="cell" className="hidden text-[0.8125rem] text-muted-foreground tabular-nums @3xl:block">
        {formatDate(doc.document_date) || "—"}
      </div>
      <div role="cell" className="hidden items-center gap-1.5 @2xl:flex">
        <StatusBadge status={doc.status} />
        {moveSuggested && (
          <Tooltip label="L'ultima analisi suggerisce un'altra posizione">
            <span className="flex size-5 items-center justify-center rounded-full bg-info-soft text-info-foreground" tabIndex={0}>
              <ArrowRightLeft className="size-3" />
              <span className="sr-only">Posizione da aggiornare</span>
            </span>
          </Tooltip>
        )}
      </div>
      <div role="cell" className="flex w-[60px] items-center justify-end gap-0.5">
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin text-muted-foreground" aria-label="Operazione in corso" />
        ) : (
          <IconButton
            label="Anteprima"
            icon={Eye}
            onClick={onPreview}
            disabled={!canPreview(doc.mime_type)}
            className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Altre azioni per ${name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onOpen}>
              <PanelRightOpen />
              Dettagli
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onPreview} disabled={!canPreview(doc.mime_type)}>
              <Eye />
              Anteprima
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => api.openExternal(driveFileUrl(doc.drive_file_id))}>
              <ExternalLink />
              Apri in Google Drive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onReanalyze} disabled={Boolean(busy)}>
              <RefreshCw />
              Ri-analizza
            </DropdownMenuItem>
            {needsRearchive(doc) && (
              <DropdownMenuItem onSelect={onMove} disabled={Boolean(busy)}>
                <ArrowRightLeft />
                {doc.status === "archived" ? "Sposta nella posizione suggerita" : "Archivia"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              Elimina…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

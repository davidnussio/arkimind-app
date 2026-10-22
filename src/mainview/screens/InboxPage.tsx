import { useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCheck,
  CircleCheck,
  Clock,
  ExternalLink,
  Eye,
  Folder,
  FolderOpen,
  FolderPlus,
  Info,
  Loader2,
  MoreHorizontal,
  PanelRightOpen,
  RefreshCw,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Callout, Skeleton } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, SignInPrompt } from "@/components/layout";
import { CategoryBadge, FileIcon, ReviewBadge, StatusBadge } from "@/components/badges";
import { EmptyState } from "@/components/EmptyState";
import { DetailPanel, PathTrail } from "@/components/DetailPanel";
import { FolderPicker } from "@/components/FolderPicker";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toaster";
import { api } from "@/lib/api";
import { countFiles, type FileOperation, type Inbox } from "@/hooks/use-inbox";
import { SKIPPED, type ActivityController } from "@/hooks/use-activity";
import {
  canPreview,
  destinationOf,
  driveFileUrl,
  driveFolderUrl,
  fileKind,
  needsReview,
  stageOf,
  type Destination,
} from "@/lib/documents";
import { errorMessage, formatDate, formatSize, formatTime, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EnrichedDriveFile, InboxFolder } from "../../shared/types";

type Filter = "all" | "new" | "ready" | "review";

const KIND_LABELS = { pdf: "PDF", image: "Immagine", doc: "Documento", sheet: "Foglio", other: "File" };

function matches(file: EnrichedDriveFile, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "new") return stageOf(file.classificationStatus) === "new";
  if (filter === "ready") return stageOf(file.classificationStatus) === "analyzed" && Boolean(destinationOf(file.classification));
  return needsReview(file.classification);
}

function fileMeta(file: EnrichedDriveFile): string[] {
  return [
    KIND_LABELS[fileKind(file.mimeType, file.name)],
    formatSize(file.size),
    file.modifiedTime ? `modificato il ${formatDate(file.modifiedTime)}` : "",
  ].filter(Boolean);
}

interface InboxPageProps {
  inbox: Inbox;
  activity: ActivityController;
  authenticated: boolean | null;
  signingIn: boolean;
  onSignIn: () => void;
  onPreview: (fileId: string, mimeType: string | null | undefined, name: string) => void;
}

export function InboxPage({ inbox, activity, authenticated, signingIn, onSignIn, onPreview }: InboxPageProps) {
  const { toast, toastError } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [dialogUploads, setDialogUploads] = useState<Set<string>>(new Set());

  const selected = inbox.allFiles.find((x) => x.file.id === selectedId) ?? null;
  const queued = new Set(
    activity.activity?.running && activity.activity.kind === "batch"
      ? activity.activity.items.filter((i) => i.status === "pending").map((i) => i.id)
      : [],
  );

  // --- Single-file actions ---

  const analyze = async (file: EnrichedDriveFile) => {
    try {
      const c = await inbox.classify(file.id);
      if (needsReview(c)) toast(`«${file.name}» analizzato: da verificare prima di archiviare`, "warning");
    } catch (e) {
      toast(`Analisi di «${file.name}» non riuscita. ${errorMessage(e)}`, "error");
    }
  };

  const archive = async (file: EnrichedDriveFile, destination: Destination) => {
    try {
      await inbox.archive(file.id, destination);
      toast(`Archiviato in ${destination.path}`, "success");
      if (selectedId === file.id) setSelectedId(null);
    } catch (e) {
      toast(`Archiviazione di «${file.name}» non riuscita. ${errorMessage(e)}`, "error");
    }
  };

  // --- Folder-wide actions (run in the activity panel) ---

  const analyzeAll = (folder: InboxFolder, files: EnrichedDriveFile[]) => {
    const todo = files.filter((f) => stageOf(f.classificationStatus) === "new");
    activity.run("batch", `Analisi di ${plural(todo.length, "file", "file")} · ${folder.name}`, todo, async (f) => {
      await inbox.classify(f.id);
    });
  };

  const archiveReady = (folder: InboxFolder, files: EnrichedDriveFile[]) => {
    const ready = files.filter((f) => matches(f, "ready"));
    const confident = ready.filter((f) => !needsReview(f.classification));
    const doubtful = ready.length - confident.length;
    const run = (selection: EnrichedDriveFile[]) => {
      setConfirm(null);
      activity.run("batch", `Archiviazione · ${folder.name}`, selection, async (f) => {
        await inbox.archive(f.id, destinationOf(f.classification)!);
      });
    };
    setConfirm({
      title: `Archiviare ${plural(ready.length, "file", "file")}?`,
      description: `I file di «${folder.name}» verranno spostati nelle cartelle proposte dall'analisi.`,
      details: doubtful > 0 && (
        <Callout tone="warning" icon={AlertTriangle}>
          {doubtful === 1 ? "1 file è" : `${doubtful} file sono`} da verificare. Puoi aprirli e correggere la
          destinazione prima di archiviare.
        </Callout>
      ),
      confirmLabel: doubtful > 0 ? `Archivia tutti e ${ready.length}` : "Archivia",
      onConfirm: () => run(ready),
      secondary:
        doubtful > 0 && confident.length > 0
          ? {
              label: confident.length === 1 ? "Solo quello sicuro" : `Solo i ${confident.length} sicuri`,
              onConfirm: () => run(confident),
            }
          : undefined,
    });
  };

  const analyzeAndArchiveAll = (folder: InboxFolder, files: EnrichedDriveFile[]) => {
    const todo = files.filter((f) => stageOf(f.classificationStatus) !== "archived");
    setConfirm({
      title: `Analizzare e archiviare ${plural(todo.length, "file", "file")}?`,
      description: `Ogni file di «${folder.name}» verrà analizzato (se serve) e spostato subito nella cartella proposta, senza revisione.`,
      confirmLabel: "Analizza e archivia",
      onConfirm: () => {
        setConfirm(null);
        activity.run("batch", `Analisi e archiviazione · ${folder.name}`, todo, async (f, isCancelled) => {
          let destination = stageOf(f.classificationStatus) === "analyzed" ? destinationOf(f.classification) : null;
          if (!destination) {
            destination = destinationOf(await inbox.classify(f.id));
            if (!destination) throw new Error("L'analisi non ha proposto una destinazione");
          }
          if (isCancelled()) return SKIPPED;
          await inbox.archive(f.id, destination);
        });
      },
    });
  };

  const uploadDropped = async (folder: InboxFolder, files: File[]) => {
    const entries = files.map((file, i) => ({ id: `${i}-${file.name}`, name: file.name, file }));
    const result = await activity.run("upload", `Caricamento in ${folder.name}`, entries, async (e) => {
      await api.uploadFile(folder.driveFolderId, e.file);
    });
    await inbox.loadFolder(folder.driveFolderId);
    if (result.errors === 0 && result.done > 0) {
      toast(`${plural(result.done, "file caricato", "file caricati")} in ${folder.name}`, "success");
      activity.dismiss();
    }
  };

  const uploadWithDialog = async (folder: InboxFolder) => {
    setDialogUploads((s) => new Set(s).add(folder.driveFolderId));
    try {
      const result = await api.openFileDialog(folder.driveFolderId);
      if (result.uploaded.length > 0) {
        await inbox.loadFolder(folder.driveFolderId);
        toast(`${plural(result.uploaded.length, "file caricato", "file caricati")} in ${folder.name}`, "success");
      }
    } catch (e) {
      toastError(e);
    } finally {
      setDialogUploads((s) => {
        const next = new Set(s);
        next.delete(folder.driveFolderId);
        return next;
      });
    }
  };

  const addFolder = async (id: string, name: string) => {
    try {
      await inbox.addFolder(id, name);
      toast(`Ora Arkimind tiene d'occhio «${name}»`, "success");
      setPickerOpen(false);
    } catch (e) {
      toastError(e);
    }
  };

  // --- Render ---

  const { counts } = inbox;
  const refreshing = Object.values(inbox.byFolder).some((s) => s.loading);
  const description =
    authenticated && inbox.loading && inbox.folders.length > 0
      ? "Caricamento dei file da Google Drive…"
      : authenticated && inbox.foldersLoaded && inbox.folders.length > 0
      ? [
          `${plural(counts.total, "file", "file")} in ${plural(inbox.folders.length, "cartella", "cartelle")}`,
          inbox.lastSync ? `aggiornato alle ${formatTime(inbox.lastSync)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "I documenti in arrivo, pronti per essere analizzati e archiviati.";

  let body: ReactNode;
  if (authenticated === null || !inbox.foldersLoaded) {
    body = <InboxSkeleton />;
  } else if (!authenticated) {
    body = (
      <SignInPrompt
        signingIn={signingIn}
        onSignIn={onSignIn}
        description="Arkimind legge i file dalle tue cartelle di Google Drive. Accedi per vedere cosa c'è da archiviare."
      />
    );
  } else if (inbox.foldersError) {
    body = (
      <EmptyState
        icon={AlertCircle}
        tone="danger"
        title="Impossibile leggere le cartelle"
        description={inbox.foldersError}
        action={
          <Button variant="outline" onClick={inbox.reload}>
            <RefreshCw />
            Riprova
          </Button>
        }
      />
    );
  } else if (inbox.folders.length === 0) {
    body = (
      <div className="rounded-2xl border border-dashed bg-card/50">
        <EmptyState
          icon={FolderPlus}
          title="Nessuna cartella da tenere d'occhio"
          description="Scegli una o più cartelle di Google Drive in cui arrivano i documenti: scansioni, allegati email, download."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              <FolderPlus />
              Aggiungi cartella
            </Button>
          }
        />
      </div>
    );
  } else {
    const visibleFolders = inbox.folders.filter(
      (folder) =>
        filter === "all" || (inbox.byFolder[folder.driveFolderId]?.files ?? []).some((f) => matches(f, filter)),
    );
    body = (
      <div className="space-y-5">
        {!inbox.loading && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={Sparkles}
              label="Da analizzare"
              value={counts.toAnalyze}
              active={filter === "new"}
              onClick={() => setFilter(filter === "new" ? "all" : "new")}
            />
            <StatCard
              icon={CheckCheck}
              label="Pronti da archiviare"
              value={counts.ready}
              tone="success"
              active={filter === "ready"}
              onClick={() => setFilter(filter === "ready" ? "all" : "ready")}
            />
            <StatCard
              icon={AlertTriangle}
              label="Da verificare"
              value={counts.toReview}
              tone="warning"
              active={filter === "review"}
              onClick={() => setFilter(filter === "review" ? "all" : "review")}
            />
          </div>
        )}

        {filter !== "all" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="size-4" />
            Stai vedendo solo i file «{{ new: "da analizzare", ready: "pronti da archiviare", review: "da verificare" }[filter]}».
            <Button variant="link" size="xs" className="px-0" onClick={() => setFilter("all")}>
              Mostra tutti
            </Button>
          </div>
        )}

        {!inbox.loading && counts.total === 0 && (
          <Callout tone="success" icon={CircleCheck} title="Tutto archiviato">
            Non ci sono file in attesa. Trascina nuovi documenti su una cartella o usa «Carica».
          </Callout>
        )}

        {visibleFolders.length === 0 && filter !== "all" && (
          <EmptyState size="sm" icon={CheckCheck} tone="success" title="Nessun file in questa vista" />
        )}

        {visibleFolders.map((folder) => (
          <FolderCard
            key={folder.driveFolderId}
            folder={folder}
            state={inbox.byFolder[folder.driveFolderId]}
            filter={filter}
            operations={inbox.operations}
            queued={queued}
            batchBusy={activity.busy}
            dialogUploading={dialogUploads.has(folder.driveFolderId)}
            onRetry={() => inbox.loadFolder(folder.driveFolderId)}
            onOpen={(f) => setSelectedId(f.id)}
            onAnalyze={analyze}
            onArchive={archive}
            onPreview={(f) => onPreview(f.id, f.mimeType, f.name)}
            onAnalyzeAll={(files) => analyzeAll(folder, files)}
            onArchiveReady={(files) => archiveReady(folder, files)}
            onAnalyzeAndArchiveAll={(files) => analyzeAndArchiveAll(folder, files)}
            onUploadDialog={() => uploadWithDialog(folder)}
            onDropFiles={(files) => uploadDropped(folder, files)}
          />
        ))}
      </div>
    );
  }

  const selectedFile = selected?.file;
  const selectedOp = selectedFile ? inbox.operations[selectedFile.id] : undefined;

  return (
    <>
      <PageHeader
        title="Da archiviare"
        description={description}
        actions={
          authenticated && (
            <>
              {inbox.folders.length > 0 && (
                <Button variant="ghost" onClick={() => setPickerOpen(true)}>
                  <FolderPlus />
                  Aggiungi cartella
                </Button>
              )}
              <Button variant="outline" onClick={inbox.reload} disabled={refreshing}>
                <RefreshCw className={cn(refreshing && "animate-spin")} />
                Aggiorna
              </Button>
            </>
          )
        }
      />
      {body}

      {selectedFile && (
        <DetailPanel
          open
          onOpenChange={(open) => !open && setSelectedId(null)}
          fileId={selectedFile.id}
          name={selectedFile.name}
          mimeType={selectedFile.mimeType}
          meta={[...fileMeta(selectedFile), `in ${selected.folder.name}`]}
          status={selectedFile.classificationStatus}
          classification={selectedFile.classification}
          editableDestination
          analyzing={selectedOp === "classify"}
          onAnalyze={() => analyze(selectedFile)}
          footer={(destination) => (
            <>
              <Button
                variant="outline"
                onClick={() => onPreview(selectedFile.id, selectedFile.mimeType, selectedFile.name)}
                disabled={!canPreview(selectedFile.mimeType)}
              >
                <Eye />
                Anteprima
              </Button>
              {selectedFile.classification && (
                <Button variant="ghost" onClick={() => analyze(selectedFile)} disabled={Boolean(selectedOp)}>
                  {selectedOp === "classify" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  Ri-analizza
                </Button>
              )}
              <div className="flex-1" />
              {selectedFile.classification ? (
                <Button
                  onClick={() => destination && archive(selectedFile, destination)}
                  disabled={!destination || Boolean(selectedOp)}
                >
                  {selectedOp === "archive" ? <Loader2 className="animate-spin" /> : <Archive />}
                  Archivia
                </Button>
              ) : (
                <Button onClick={() => analyze(selectedFile)} disabled={Boolean(selectedOp)}>
                  {selectedOp === "classify" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Analizza
                </Button>
              )}
            </>
          )}
        />
      )}

      <FolderPicker
        open={pickerOpen}
        title="Aggiungi una cartella da archiviare"
        description="I file che arrivano in questa cartella di Drive compariranno qui, pronti per l'analisi."
        disabledIds={inbox.folders.map((f) => f.driveFolderId)}
        onSelect={addFolder}
        onClose={() => setPickerOpen(false)}
      />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
  active,
  onClick,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  tone?: "primary" | "success" | "warning";
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    primary: "bg-accent text-accent-foreground",
    success: "bg-success-soft text-success-foreground",
    warning: "bg-warning-soft text-warning-foreground",
  };
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      disabled={value === 0 && !active}
      className={cn(
        "group flex items-center gap-3.5 rounded-xl border bg-card p-3.5 text-left shadow-xs transition-[border-color,box-shadow] outline-none hover:border-ring/50 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-default disabled:hover:border-border",
        active && "border-primary ring-1 ring-primary",
      )}
    >
      <span className={cn("flex size-10 items-center justify-center rounded-lg", tones[tone], value === 0 && "opacity-50")}>
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-2xl leading-none font-semibold tabular-nums", value === 0 && "text-muted-foreground")}>
          {value}
        </span>
        <span className="mt-1 block text-[0.8125rem] leading-snug text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

interface FolderCardProps {
  folder: InboxFolder;
  state: Inbox["byFolder"][string] | undefined;
  filter: Filter;
  operations: Record<string, FileOperation>;
  queued: Set<string>;
  batchBusy: boolean;
  dialogUploading: boolean;
  onRetry: () => void;
  onOpen: (file: EnrichedDriveFile) => void;
  onAnalyze: (file: EnrichedDriveFile) => void;
  onArchive: (file: EnrichedDriveFile, destination: Destination) => void;
  onPreview: (file: EnrichedDriveFile) => void;
  onAnalyzeAll: (files: EnrichedDriveFile[]) => void;
  onArchiveReady: (files: EnrichedDriveFile[]) => void;
  onAnalyzeAndArchiveAll: (files: EnrichedDriveFile[]) => void;
  onUploadDialog: () => void;
  onDropFiles: (files: File[]) => void;
}

function FolderCard({
  folder,
  state,
  filter,
  operations,
  queued,
  batchBusy,
  dialogUploading,
  onRetry,
  onOpen,
  onAnalyze,
  onArchive,
  onPreview,
  onAnalyzeAll,
  onArchiveReady,
  onAnalyzeAndArchiveAll,
  onUploadDialog,
  onDropFiles,
}: FolderCardProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const files = state?.files ?? null;
  const counts = countFiles(files ?? []);
  const visible = (files ?? []).filter((f) => matches(f, filter));

  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const dragHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current++;
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) onDropFiles(dropped);
    },
  };

  const summary = files
    ? [
        plural(counts.total, "file", "file"),
        counts.toAnalyze ? `${counts.toAnalyze} da analizzare` : null,
        counts.ready ? `${counts.ready} ${counts.ready === 1 ? "pronto" : "pronti"}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : state?.error
      ? "Non disponibile"
      : "Caricamento…";

  return (
    <section
      aria-label={`Cartella ${folder.name}`}
      className={cn(
        "@container relative overflow-hidden rounded-2xl border bg-card shadow-xs transition-[border-color,box-shadow]",
        dragging && "border-primary ring-2 ring-primary/30",
      )}
      {...dragHandlers}
    >
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <FolderOpen className="size-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[0.9375rem] font-semibold">{folder.name}</h2>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip label="Carica file dal computer (o trascinali qui)">
            <Button variant="ghost" size="sm" onClick={onUploadDialog} disabled={dialogUploading}>
              {dialogUploading ? <Loader2 className="animate-spin" /> : <Upload />}
              Carica
            </Button>
          </Tooltip>
          {counts.toAnalyze > 0 && (
            <Button variant="outline" size="sm" onClick={() => onAnalyzeAll(files ?? [])} disabled={batchBusy}>
              <Sparkles />
              Analizza {counts.toAnalyze}
            </Button>
          )}
          {counts.ready > 0 && (
            <Button size="sm" onClick={() => onArchiveReady(files ?? [])} disabled={batchBusy}>
              <Archive />
              Archivia {counts.ready}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Altre azioni per ${folder.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                disabled={batchBusy || counts.total === 0}
                onSelect={() => onAnalyzeAndArchiveAll(files ?? [])}
              >
                <Zap />
                Analizza e archivia tutto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onRetry}>
                <RefreshCw />
                Aggiorna cartella
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => api.openExternal(driveFolderUrl(folder.driveFolderId))}>
                <ExternalLink />
                Apri in Google Drive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {state?.error ? (
        <div className="p-4">
          <Callout
            tone="danger"
            icon={AlertCircle}
            title="Impossibile leggere i file di questa cartella"
            action={
              <Button variant="outline" size="sm" onClick={onRetry} disabled={state.loading}>
                {state.loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Riprova
              </Button>
            }
          >
            {state.error}
          </Callout>
        </div>
      ) : files === null ? (
        <div className="divide-y" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <button
          onClick={onUploadDialog}
          className="flex w-full items-center justify-center gap-2.5 px-4 py-7 text-sm text-muted-foreground hover:bg-muted/40"
        >
          <Upload className="size-4" />
          Cartella vuota: trascina qui i documenti o fai clic per caricarli
        </button>
      ) : (
        <div role="table" aria-label={`File in ${folder.name}`}>
          <div
            role="row"
            className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_10.5rem] gap-4 border-b bg-muted/40 px-4 py-2 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase @2xl:grid @3xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.1fr)_10.5rem]"
          >
            <span role="columnheader">File</span>
            <span role="columnheader">Risultato dell'analisi</span>
            <span role="columnheader" className="hidden @3xl:block">
              Destinazione proposta
            </span>
            <span role="columnheader">
              <span className="sr-only">Azioni</span>
            </span>
          </div>
          <div className="divide-y">
            {visible.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                operation={operations[file.id]}
                queued={queued.has(file.id)}
                onOpen={() => onOpen(file)}
                onAnalyze={() => onAnalyze(file)}
                onArchive={(d) => onArchive(file, d)}
                onPreview={() => onPreview(file)}
              />
            ))}
          </div>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/85 backdrop-blur-[1px]">
          <div className="flex items-center gap-2.5 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-lg">
            <Upload className="size-4" />
            Rilascia per caricare in «{folder.name}»
          </div>
        </div>
      )}
    </section>
  );
}

function FileRow({
  file,
  operation,
  queued,
  onOpen,
  onAnalyze,
  onArchive,
  onPreview,
}: {
  file: EnrichedDriveFile;
  operation: FileOperation | undefined;
  /** Waiting for its turn in a batch. */
  queued: boolean;
  onOpen: () => void;
  onAnalyze: () => void;
  onArchive: (destination: Destination) => void;
  onPreview: () => void;
}) {
  const stage = stageOf(file.classificationStatus);
  const c = file.classification;
  const destination = destinationOf(c);
  const review = needsReview(c);
  const profile = c?.document_profile;

  let primary: ReactNode;
  if (queued && !operation) {
    primary = (
      <Button variant="ghost" size="sm" disabled>
        <Clock />
        In coda
      </Button>
    );
  } else if (operation === "classify") {
    primary = (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="animate-spin" />
        Analisi…
      </Button>
    );
  } else if (operation === "archive") {
    primary = (
      <Button variant="soft" size="sm" disabled>
        <Loader2 className="animate-spin" />
        Sposto…
      </Button>
    );
  } else if (stage === "new" || !c) {
    primary = (
      <Button variant="outline" size="sm" onClick={onAnalyze}>
        <Sparkles />
        Analizza
      </Button>
    );
  } else if (stage === "archived") {
    primary = <StatusBadge status={file.classificationStatus} />;
  } else if (review || !destination) {
    primary = (
      <Button variant="outline" size="sm" onClick={onOpen}>
        <PanelRightOpen />
        Verifica
      </Button>
    );
  } else {
    primary = (
      <Tooltip label={`Sposta in ${destination.path}`}>
        <Button variant="soft" size="sm" onClick={() => onArchive(destination)}>
          <Archive />
          Archivia
        </Button>
      </Tooltip>
    );
  }

  return (
    <div
      role="row"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button,[role=menuitem]")) onOpen();
      }}
      className="group grid cursor-default grid-cols-[minmax(0,1fr)_10.5rem] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted/40 @2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_10.5rem] @3xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.1fr)_10.5rem]"
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <FileIcon mimeType={file.mimeType} name={file.name} />
        <div className="min-w-0">
          <button
            onClick={onOpen}
            className="block max-w-full truncate rounded text-left text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
            title={file.name}
          >
            {file.name}
          </button>
          <p className="truncate text-xs text-muted-foreground">
            {[formatSize(file.size), formatDate(file.modifiedTime)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div role="cell" className="hidden min-w-0 @2xl:block">
        {operation === "classify" && !c ? (
          <span className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Analisi in corso…
          </span>
        ) : c ? (
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <CategoryBadge category={profile?.category} />
              {review && <ReviewBadge />}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {[profile?.entity, formatDate(profile?.document_date)].filter(Boolean).join(" · ") || profile?.document_type}
            </p>
          </div>
        ) : (
          <span className="text-[0.8125rem] text-muted-foreground/80">Non ancora analizzato</span>
        )}
      </div>

      <div role="cell" className="hidden min-w-0 text-[0.8125rem] @3xl:block">
        {destination ? (
          <div className="flex min-w-0 items-start gap-2" title={`${destination.path}/${destination.filename}`}>
            <Folder className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span className="line-clamp-2 min-w-0 break-words">
              <PathTrail path={destination.path} />
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </div>

      <div role="cell" className="flex items-center justify-end gap-1">
        <IconButton
          label="Anteprima"
          icon={Eye}
          onClick={onPreview}
          disabled={!canPreview(file.mimeType)}
          className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        />
        {primary}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Altre azioni per ${file.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onOpen}>
              <PanelRightOpen />
              Dettagli
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onPreview} disabled={!canPreview(file.mimeType)}>
              <Eye />
              Anteprima
            </DropdownMenuItem>
            {c && (
              <DropdownMenuItem onSelect={onAnalyze} disabled={Boolean(operation)}>
                <RefreshCw />
                Ri-analizza
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => api.openExternal(driveFileUrl(file.id))}>
              <ExternalLink />
              Apri in Google Drive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Caricamento">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[70px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

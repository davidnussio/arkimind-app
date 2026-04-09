import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { ClassificationResult } from "./ClassificationResult";
import { ClassificationEditor } from "./ClassificationEditor";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";
import { PreviewModal } from "./PreviewModal";
import { UploadProgress, type UploadFileStatus } from "./UploadProgress";
import { BatchOperationProgress, type BatchItemStatus } from "./BatchOperationProgress";
import {
  FolderOpen,
  RefreshCw,
  Loader2,
  FileText,
  Image,
  File,
  Eye,
  Sparkles,
  Archive,
  ChevronDown,
  ChevronRight,
  Upload,
  Pencil,
  Zap,
  FolderInput,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { useToast } from "./Toaster";

interface InboxFolder {
  id: number;
  driveFolderId: string;
  name: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  classificationStatus: string | null;
  classification: any | null;
}

interface DashboardProps {
  onSync?: () => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="size-4 text-purple-500" />;
  if (mimeType === "application/pdf") return <FileText className="size-4 text-red-500" />;
  return <File className="size-4 text-gray-500" />;
}

function formatSize(bytes?: string): string {
  if (!bytes) return "";
  const b = parseInt(bytes, 10);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function Dashboard({ onSync }: DashboardProps) {
  const { toastError, toast } = useToast();
  const [inboxFolders, setInboxFolders] = useState<InboxFolder[]>([]);
  const [folderFiles, setFolderFiles] = useState<Record<string, DriveFile[]>>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<{ fileId: string; mimeType: string; name: string } | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [classifyingFiles, setClassifyingFiles] = useState<Set<string>>(new Set());
  const [archivingFiles, setArchivingFiles] = useState<Set<string>>(new Set());
  const [selectedClassification, setSelectedClassification] = useState<{
    fileId: string; data: any; fileName: string; parentFolderId: string;
  } | null>(null);
  const [uploadingFolders, setUploadingFolders] = useState<Set<string>>(new Set());
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  // New states for UX improvements
  const [archiveConfirm, setArchiveConfirm] = useState<{
    fileId: string; parentFolderId: string; classification: any; fileName: string;
  } | null>(null);
  const [editingClassification, setEditingClassification] = useState<{
    fileId: string; data: any; fileName: string; parentFolderId: string;
  } | null>(null);
  const [uploadFiles, setUploadFiles] = useState<UploadFileStatus[]>([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  // Batch operations
  const [batchItems, setBatchItems] = useState<BatchItemStatus[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchTitle, setBatchTitle] = useState("");
  const [showBatch, setShowBatch] = useState(false);
  const batchCancelRef = useRef(false);

  const runBatchClassify = async (folderId: string, files: DriveFile[]) => {
    const unclassified = files.filter((f) => f.classificationStatus !== "classified" && f.classificationStatus !== "archived");
    if (unclassified.length === 0) {
      toast("Tutti i file sono già classificati", "info");
      return;
    }
    batchCancelRef.current = false;
    const items: BatchItemStatus[] = unclassified.map((f) => ({ id: f.id, name: f.name, status: "pending" }));
    setBatchItems(items);
    setBatchTitle("Classificazione batch");
    setBatchRunning(true);
    setShowBatch(true);

    for (let i = 0; i < unclassified.length; i++) {
      if (batchCancelRef.current) {
        setBatchItems((prev) => prev.map((it, j) => j >= i && it.status === "pending" ? { ...it, status: "skipped" } : it));
        break;
      }
      setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "running" } : it));
      try {
        const result = await api.classifyFile(unclassified[i].id);
        if (result.success && result.classification) {
          setFolderFiles((prev) => {
            const updated = { ...prev };
            for (const fId in updated) {
              updated[fId] = updated[fId].map((f) =>
                f.id === unclassified[i].id
                  ? { ...f, classificationStatus: "classified", classification: result.classification }
                  : f,
              );
            }
            return updated;
          });
        }
        setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "done" } : it));
      } catch (e: unknown) {
        setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "error", error: e instanceof Error ? e.message : "Errore" } : it));
      }
    }
    setBatchRunning(false);
  };

  const runBatchArchive = async (folderId: string, files: DriveFile[]) => {
    const archivable = files.filter((f) => f.classificationStatus === "classified" && f.classification?.filing_strategy?.full_suggested_path && f.classification?.filing_strategy?.suggested_filename);
    if (archivable.length === 0) {
      toast("Nessun file classificato da archiviare", "info");
      return;
    }
    batchCancelRef.current = false;
    const items: BatchItemStatus[] = archivable.map((f) => ({ id: f.id, name: f.name, status: "pending" }));
    setBatchItems(items);
    setBatchTitle("Archiviazione batch");
    setBatchRunning(true);
    setShowBatch(true);

    for (let i = 0; i < archivable.length; i++) {
      if (batchCancelRef.current) {
        setBatchItems((prev) => prev.map((it, j) => j >= i && it.status === "pending" ? { ...it, status: "skipped" } : it));
        break;
      }
      setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "running" } : it));
      try {
        const file = archivable[i];
        const targetPath = file.classification!.filing_strategy.full_suggested_path;
        const targetFilename = file.classification!.filing_strategy.suggested_filename;
        await api.archiveFile(file.id, targetPath, targetFilename);
        setFolderFiles((prev) => {
          const updated = { ...prev };
          updated[folderId] = (updated[folderId] ?? []).filter((f) => f.id !== file.id);
          return updated;
        });
        setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "done" } : it));
      } catch (e: unknown) {
        setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "error", error: e instanceof Error ? e.message : "Errore" } : it));
      }
    }
    setBatchRunning(false);
  };

  const runBatchClassifyAndArchive = async (folderId: string, files: DriveFile[]) => {
    const pending = files.filter((f) => f.classificationStatus !== "archived");
    if (pending.length === 0) {
      toast("Tutti i file sono già archiviati", "info");
      return;
    }
    batchCancelRef.current = false;
    const items: BatchItemStatus[] = pending.map((f) => ({ id: f.id, name: f.name, status: "pending" }));
    setBatchItems(items);
    setBatchTitle("Classifica e archivia batch");
    setBatchRunning(true);
    setShowBatch(true);

    for (let i = 0; i < pending.length; i++) {
      if (batchCancelRef.current) {
        setBatchItems((prev) => prev.map((it, j) => j >= i && it.status === "pending" ? { ...it, status: "skipped" } : it));
        break;
      }
      setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "running" } : it));
      const file = pending[i];
      try {
        // Step 1: classify if needed
        let classification = file.classification;
        if (file.classificationStatus !== "classified" || !classification?.filing_strategy?.full_suggested_path) {
          const result = await api.classifyFile(file.id);
          if (!result.success || !result.classification) {
            setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "error", error: result.error ?? "Classificazione fallita" } : it));
            continue;
          }
          classification = result.classification;
          setFolderFiles((prev) => {
            const updated = { ...prev };
            for (const fId in updated) {
              updated[fId] = updated[fId].map((f) =>
                f.id === file.id ? { ...f, classificationStatus: "classified", classification } : f,
              );
            }
            return updated;
          });
        }
        if (batchCancelRef.current) {
          setBatchItems((prev) => prev.map((it, j) => j >= i && it.status !== "done" && it.status !== "error" ? { ...it, status: "skipped" } : it));
          break;
        }
        // Step 2: archive
        const targetPath = classification.filing_strategy?.full_suggested_path;
        const targetFilename = classification.filing_strategy?.suggested_filename;
        if (!targetPath || !targetFilename) {
          setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "error", error: "Dati archiviazione mancanti" } : it));
          continue;
        }
        await api.archiveFile(file.id, targetPath, targetFilename);
        setFolderFiles((prev) => {
          const updated = { ...prev };
          updated[folderId] = (updated[folderId] ?? []).filter((f) => f.id !== file.id);
          return updated;
        });
        setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "done" } : it));
      } catch (e: unknown) {
        setBatchItems((prev) => prev.map((it, j) => j === i ? { ...it, status: "error", error: e instanceof Error ? e.message : "Errore" } : it));
      }
    }
    setBatchRunning(false);
  };

  const handleBatchStop = () => {
    batchCancelRef.current = true;
  };

  const handleBatchClose = () => {
    setShowBatch(false);
    setBatchItems([]);
  };

  const loadInboxFolders = useCallback(async () => {
    try {
      const folders = await api.getInboxFolders();
      setInboxFolders(folders);
      const expanded = new Set(folders.map((f) => f.driveFolderId));
      setExpandedFolders(expanded);
      for (const folder of folders) {
        loadFolderFiles(folder.driveFolderId);
      }
    } catch (e: unknown) {
      toastError(e);
    }
  }, []);

  useEffect(() => {
    loadInboxFolders();
  }, [loadInboxFolders]);

  const loadFolderFiles = async (folderId: string) => {
    setLoadingFolders((prev) => new Set(prev).add(folderId));
    try {
      const files = await api.listFiles(folderId);
      setFolderFiles((prev) => ({ ...prev, [folderId]: files }));
    } catch (e: unknown) {
      toastError(e);
    } finally {
      setLoadingFolders((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
        if (!folderFiles[folderId]) loadFolderFiles(folderId);
      }
      return next;
    });
  };

  const handlePreview = async (file: DriveFile) => {
    setPreviewFile({ fileId: file.id, mimeType: file.mimeType, name: file.name });
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const result = await api.getFilePreview(file.id, file.mimeType);
      setPreviewData(result?.dataUrl ?? null);
    } catch (e) {
      toastError(e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClassify = async (file: DriveFile, parentFolderId: string) => {
    setClassifyingFiles((prev) => new Set(prev).add(file.id));
    try {
      const result = await api.classifyFile(file.id);
      if (result.success && result.classification) {
        setFolderFiles((prev) => {
          const updated = { ...prev };
          for (const folderId in updated) {
            updated[folderId] = updated[folderId].map((f) =>
              f.id === file.id
                ? { ...f, classificationStatus: "classified", classification: result.classification }
                : f,
            );
          }
          return updated;
        });
        setSelectedClassification({
          fileId: file.id,
          data: result.classification,
          fileName: file.name,
          parentFolderId,
        });
      }
    } catch (e: unknown) {
      toastError(e);
    } finally {
      setClassifyingFiles((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  };

  // Archive with confirmation dialog
  const requestArchive = (fileId: string, parentFolderId: string, classification: any, fileName: string) => {
    setArchiveConfirm({ fileId, parentFolderId, classification, fileName });
  };

  const handleArchive = async (fileId: string, parentFolderId: string, classification: any) => {
    setArchivingFiles((prev) => new Set(prev).add(fileId));
    try {
      const targetPath = classification.filing_strategy?.full_suggested_path ?? "";
      const targetFilename = classification.filing_strategy?.suggested_filename ?? "";
      if (!targetPath || !targetFilename) {
        toastError(new Error("Dati di archiviazione mancanti nella classificazione"));
        return;
      }
      await api.archiveFile(fileId, targetPath, targetFilename);
      setFolderFiles((prev) => {
        const updated = { ...prev };
        updated[parentFolderId] = (updated[parentFolderId] ?? []).filter((f) => f.id !== fileId);
        return updated;
      });
      setSelectedClassification(null);
      setArchiveConfirm(null);
    } catch (e: unknown) {
      toastError(e);
    } finally {
      setArchivingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  // Upload with per-file progress
  const handleUploadFiles = async (folderId: string, files: File[]) => {
    if (files.length === 0) return;
    setUploadingFolders((prev) => new Set(prev).add(folderId));
    const statuses: UploadFileStatus[] = files.map((f) => ({ name: f.name, status: "pending" as const }));
    setUploadFiles(statuses);
    setShowUploadProgress(true);

    for (let i = 0; i < files.length; i++) {
      setUploadFiles((prev) => prev.map((s, j) => j === i ? { ...s, status: "uploading" } : s));
      try {
        await api.uploadFile(folderId, files[i]);
        setUploadFiles((prev) => prev.map((s, j) => j === i ? { ...s, status: "done" } : s));
      } catch (e: unknown) {
        setUploadFiles((prev) => prev.map((s, j) => j === i ? { ...s, status: "error", error: e instanceof Error ? e.message : "Errore" } : s));
      }
    }

    await loadFolderFiles(folderId);
    setUploadingFolders((prev) => {
      const next = new Set(prev);
      next.delete(folderId);
      return next;
    });
    setTimeout(() => setShowUploadProgress(false), 2000);
  };

  const handleFileDialog = async (folderId: string) => {
    setUploadingFolders((prev) => new Set(prev).add(folderId));
    try {
      const result = await api.openFileDialog(folderId);
      if (result.uploaded.length > 0) {
        await loadFolderFiles(folderId);
      }
    } catch (e: unknown) {
      toastError(e);
    } finally {
      setUploadingFolders((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
  };

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleUploadFiles(folderId, files);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
  };

  const handleRefreshAll = () => {
    for (const folder of inboxFolders) {
      loadFolderFiles(folder.driveFolderId);
    }
    onSync?.();
  };

  // Handle classification edit save
  const handleSaveEditedClassification = (updated: any) => {
    if (!editingClassification) return;
    // Update local state with edited classification
    setFolderFiles((prev) => {
      const result = { ...prev };
      for (const folderId in result) {
        result[folderId] = result[folderId].map((f) =>
          f.id === editingClassification.fileId
            ? { ...f, classification: updated }
            : f,
        );
      }
      return result;
    });
    // Update the selected classification if it's the same file
    if (selectedClassification?.fileId === editingClassification.fileId) {
      setSelectedClassification({ ...selectedClassification, data: updated });
    }
    setEditingClassification(null);
  };

  if (inboxFolders.length === 0) {
    return (
      <EmptyState
        illustration="folder"
        title="Nessuna cartella inbox"
        description="Vai nelle Impostazioni per aggiungere cartelle Google Drive da monitorare."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <Button variant="outline" size="sm" onClick={handleRefreshAll}>
          <RefreshCw className="size-3.5" />
          Aggiorna
        </Button>
      </div>

      {/* Inbox folders */}
      {inboxFolders.map((folder) => (
        <div
          key={folder.driveFolderId}
          className={`rounded-lg border transition-colors ${
            dragOverFolder === folder.driveFolderId
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
              : "border-border"
          }`}
          onDrop={(e) => handleDrop(e, folder.driveFolderId)}
          onDragOver={(e) => handleDragOver(e, folder.driveFolderId)}
          onDragLeave={handleDragLeave}
        >
          {/* Folder header */}
          <div className="flex w-full items-center gap-2 px-4 py-3">
            <button
              onClick={() => toggleFolder(folder.driveFolderId)}
              className="flex flex-1 items-center gap-2 text-left hover:opacity-70"
            >
              {expandedFolders.has(folder.driveFolderId) ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <FolderOpen className="size-4 text-blue-500" />
              <span className="flex-1 text-sm font-medium">{folder.name}</span>
              {loadingFolders.has(folder.driveFolderId) && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {folderFiles[folder.driveFolderId] && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {folderFiles[folder.driveFolderId].length} file
                </span>
              )}
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFileDialog(folder.driveFolderId)}
              disabled={uploadingFolders.has(folder.driveFolderId)}
              title="Carica file"
            >
              {uploadingFolders.has(folder.driveFolderId) ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              <span className="text-xs">Carica</span>
            </Button>
            {folderFiles[folder.driveFolderId] && folderFiles[folder.driveFolderId].length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runBatchClassify(folder.driveFolderId, folderFiles[folder.driveFolderId])}
                  disabled={batchRunning}
                  title="Classifica tutti i file non classificati"
                >
                  <Sparkles className="size-3.5" />
                  <span className="text-xs">Analizza tutti</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runBatchArchive(folder.driveFolderId, folderFiles[folder.driveFolderId])}
                  disabled={batchRunning}
                  title="Archivia tutti i file classificati"
                >
                  <Archive className="size-3.5" />
                  <span className="text-xs">Archivia tutti</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => runBatchClassifyAndArchive(folder.driveFolderId, folderFiles[folder.driveFolderId])}
                  disabled={batchRunning}
                  title="Classifica e archivia tutti i file"
                >
                  <Zap className="size-3.5" />
                  <span className="text-xs">Classifica e archivia</span>
                </Button>
              </>
            )}
          </div>

          {/* Files list */}
          {expandedFolders.has(folder.driveFolderId) && (
            <div className="border-t border-border">
              {!folderFiles[folder.driveFolderId] ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : folderFiles[folder.driveFolderId].length === 0 ? (
                <EmptyState
                  illustration="folder"
                  title="Cartella vuota"
                  description="Trascina file qui o usa il pulsante Carica per aggiungere documenti."
                />
              ) : (
                <>
                  {dragOverFolder === folder.driveFolderId && (
                    <div className="flex items-center justify-center gap-2 border-b border-blue-200 bg-blue-50/80 py-3 dark:border-blue-800 dark:bg-blue-900/20">
                      <Upload className="size-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        Rilascia per caricare
                      </span>
                    </div>
                  )}
                  <ul className="divide-y divide-border">
                    {folderFiles[folder.driveFolderId].map((file) => (
                      <li key={file.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                        {getFileIcon(file.mimeType)}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatSize(file.size)}
                            {file.modifiedTime && ` · ${formatDate(file.modifiedTime)}`}
                          </p>
                        </div>

                        {file.classificationStatus && (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${
                            file.classificationStatus === "archived"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}>
                            {file.classificationStatus === "archived" ? "Archiviato" : "Classificato"}
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-xs" onClick={() => handlePreview(file)} title="Anteprima">
                            <Eye className="size-3.5" />
                          </Button>

                          {file.classificationStatus === "classified" && file.classification ? (
                            <>
                              <Button variant="ghost" size="icon-xs"
                                onClick={() => setSelectedClassification({
                                  fileId: file.id, data: file.classification, fileName: file.name, parentFolderId: folder.driveFolderId,
                                })}
                                title="Vedi classificazione"
                              >
                                <Sparkles className="size-3.5 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="icon-xs"
                                onClick={() => setEditingClassification({
                                  fileId: file.id, data: file.classification, fileName: file.name, parentFolderId: folder.driveFolderId,
                                })}
                                title="Modifica classificazione"
                              >
                                <Pencil className="size-3.5 text-amber-500" />
                              </Button>
                              <Button variant="ghost" size="icon-xs"
                                onClick={() => requestArchive(file.id, folder.driveFolderId, file.classification, file.name)}
                                disabled={archivingFiles.has(file.id)}
                                title="Archivia"
                              >
                                {archivingFiles.has(file.id) ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Archive className="size-3.5 text-green-600" />
                                )}
                              </Button>
                              <Button variant="ghost" size="icon-xs"
                                onClick={() => handleClassify(file, folder.driveFolderId)}
                                disabled={classifyingFiles.has(file.id)}
                                title="Ri-analizza"
                              >
                                {classifyingFiles.has(file.id) ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="size-3.5" />
                                )}
                              </Button>
                            </>
                          ) : file.classificationStatus === "archived" ? (
                            <Button variant="ghost" size="sm"
                              onClick={() => handleClassify(file, folder.driveFolderId)}
                              disabled={classifyingFiles.has(file.id)}
                              title="Ri-analizza"
                            >
                              {classifyingFiles.has(file.id) ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="size-3.5" />
                              )}
                              <span className="text-xs">Ri-analizza</span>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm"
                              onClick={() => handleClassify(file, folder.driveFolderId)}
                              disabled={classifyingFiles.has(file.id)}
                            >
                              {classifyingFiles.has(file.id) ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="size-3.5" />
                              )}
                              <span className="text-xs">Analizza</span>
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      ))}

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

      {/* Classification Result Modal */}
      {selectedClassification && (
        <ClassificationResult
          classification={selectedClassification.data}
          fileName={selectedClassification.fileName}
          onArchive={() => requestArchive(
            selectedClassification.fileId,
            selectedClassification.parentFolderId,
            selectedClassification.data,
            selectedClassification.fileName,
          )}
          onEdit={() => {
            setEditingClassification(selectedClassification);
            setSelectedClassification(null);
          }}
          onClose={() => setSelectedClassification(null)}
          archiving={archivingFiles.has(selectedClassification.fileId)}
        />
      )}

      {/* Archive Confirmation Dialog */}
      {archiveConfirm && (
        <ArchiveConfirmDialog
          fileName={archiveConfirm.fileName}
          targetPath={archiveConfirm.classification.filing_strategy?.full_suggested_path ?? ""}
          targetFilename={archiveConfirm.classification.filing_strategy?.suggested_filename ?? ""}
          onConfirm={() => handleArchive(archiveConfirm.fileId, archiveConfirm.parentFolderId, archiveConfirm.classification)}
          onCancel={() => setArchiveConfirm(null)}
          archiving={archivingFiles.has(archiveConfirm.fileId)}
        />
      )}

      {/* Classification Editor */}
      {editingClassification && (
        <ClassificationEditor
          classification={editingClassification.data}
          onSave={handleSaveEditedClassification}
          onCancel={() => setEditingClassification(null)}
        />
      )}

      {/* Upload Progress */}
      <UploadProgress files={uploadFiles} visible={showUploadProgress} />

      {/* Batch Operation Progress */}
      {showBatch && (
        <BatchOperationProgress
          title={batchTitle}
          items={batchItems}
          onStop={handleBatchStop}
          onClose={handleBatchClose}
          running={batchRunning}
        />
      )}
    </div>
  );
}

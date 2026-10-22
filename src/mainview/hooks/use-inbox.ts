import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { destinationOf, needsReview, stageOf, type Destination } from "@/lib/documents";
import type { ClassificationResult, EnrichedDriveFile, InboxFolder } from "../../shared/types";

export interface FolderFiles {
  files: EnrichedDriveFile[] | null;
  loading: boolean;
  error: string | null;
}

export type FileOperation = "classify" | "archive";

export interface InboxCounts {
  total: number;
  toAnalyze: number;
  ready: number;
  toReview: number;
}

export function countFiles(files: EnrichedDriveFile[]): InboxCounts {
  const counts: InboxCounts = { total: files.length, toAnalyze: 0, ready: 0, toReview: 0 };
  for (const f of files) {
    if (stageOf(f.classificationStatus) === "new") counts.toAnalyze++;
    else if (stageOf(f.classificationStatus) === "analyzed" && destinationOf(f.classification)) counts.ready++;
    if (needsReview(f.classification)) counts.toReview++;
  }
  return counts;
}

/**
 * Inbox folders and their Drive files. Lives in App so the list, per-file
 * spinners and batch progress survive switching pages.
 */
export function useInbox(driveReady: boolean) {
  const [folders, setFolders] = useState<InboxFolder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [byFolder, setByFolder] = useState<Record<string, FolderFiles>>({});
  const [operations, setOperations] = useState<Record<string, FileOperation>>({});
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadFolder = useCallback(async (folderId: string) => {
    setByFolder((prev) => ({
      ...prev,
      [folderId]: { files: prev[folderId]?.files ?? null, loading: true, error: null },
    }));
    try {
      const files = await api.listFiles(folderId);
      setByFolder((prev) => ({ ...prev, [folderId]: { files, loading: false, error: null } }));
    } catch (e) {
      setByFolder((prev) => ({
        ...prev,
        [folderId]: { files: prev[folderId]?.files ?? null, loading: false, error: errorMessage(e) },
      }));
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = await api.getInboxFolders();
      setFolders(list);
      setFoldersError(null);
      setByFolder((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => list.some((f) => f.driveFolderId === id))),
      );
      setFoldersLoaded(true);
      if (driveReady) {
        await Promise.all(list.map((f) => loadFolder(f.driveFolderId)));
        setLastSync(new Date());
      }
    } catch (e) {
      setFoldersError(errorMessage(e));
      setFoldersLoaded(true);
    }
  }, [driveReady, loadFolder]);

  useEffect(() => {
    reload();
  }, [reload]);

  const updateFile = useCallback(
    (fileId: string, update: (file: EnrichedDriveFile) => EnrichedDriveFile) =>
      setByFolder((prev) => {
        const next: Record<string, FolderFiles> = {};
        for (const [id, state] of Object.entries(prev)) {
          next[id] = state.files
            ? { ...state, files: state.files.map((f) => (f.id === fileId ? update(f) : f)) }
            : state;
        }
        return next;
      }),
    [],
  );

  const removeFile = useCallback(
    (fileId: string) =>
      setByFolder((prev) => {
        const next: Record<string, FolderFiles> = {};
        for (const [id, state] of Object.entries(prev)) {
          next[id] = state.files ? { ...state, files: state.files.filter((f) => f.id !== fileId) } : state;
        }
        return next;
      }),
    [],
  );

  const track = useCallback(async <T,>(fileId: string, op: FileOperation, task: () => Promise<T>) => {
    setOperations((o) => ({ ...o, [fileId]: op }));
    try {
      return await task();
    } finally {
      setOperations((o) => {
        const { [fileId]: _done, ...rest } = o;
        return rest;
      });
    }
  }, []);

  /** Runs the AI classification and stores the result on the file. Throws on failure. */
  const classify = useCallback(
    (fileId: string): Promise<ClassificationResult> =>
      track(fileId, "classify", async () => {
        const result = await api.classifyFile(fileId);
        if (!result.success || !result.classification) {
          throw new Error(result.error ?? "Analisi non riuscita");
        }
        const classification = result.classification;
        updateFile(fileId, (f) => ({
          ...f,
          classification,
          classificationStatus: f.classificationStatus === "archived" ? "archived" : "classified",
        }));
        return classification;
      }),
    [track, updateFile],
  );

  /** Moves the file into the archive folder and drops it from the inbox. Throws on failure. */
  const archive = useCallback(
    (fileId: string, destination: Destination) =>
      track(fileId, "archive", async () => {
        await api.archiveFile(fileId, destination.path, destination.filename);
        removeFile(fileId);
      }),
    [track, removeFile],
  );

  const addFolder = useCallback(
    async (driveFolderId: string, name: string) => {
      await api.addInboxFolder(driveFolderId, name);
      await reload();
    },
    [reload],
  );

  const allFiles = useMemo(
    () =>
      folders.flatMap((folder) =>
        (byFolder[folder.driveFolderId]?.files ?? []).map((file) => ({ file, folder })),
      ),
    [folders, byFolder],
  );

  const counts = useMemo(() => countFiles(allFiles.map((x) => x.file)), [allFiles]);

  const loading =
    !foldersLoaded || (driveReady && folders.some((f) => byFolder[f.driveFolderId]?.files == null && !byFolder[f.driveFolderId]?.error));

  return {
    folders,
    foldersLoaded,
    foldersError,
    byFolder,
    allFiles,
    counts,
    loading,
    lastSync,
    operations,
    reload,
    loadFolder,
    classify,
    archive,
    addFolder,
  };
}

export type Inbox = ReturnType<typeof useInbox>;

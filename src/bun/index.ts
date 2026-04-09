import Electrobun from "electrobun/bun";
import {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Updater,
  Utils,
} from "electrobun/bun";
import * as path from "node:path";
import * as db from "./db";
import * as auth from "./auth";
import * as drive from "./drive";
import type { ArkimindRPC, ClassificationResult } from "../shared/types";

// Application menu with standard Edit roles + custom shortcuts
ApplicationMenu.setApplicationMenu([
  {
    label: "Arkimind",
    submenu: [
      { role: "hide" },
      { role: "hideOthers" },
      { role: "showAll" },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { label: "Dashboard", action: "nav-dashboard", accelerator: "CmdOrCtrl+1" },
      { label: "Documenti", action: "nav-documents", accelerator: "CmdOrCtrl+2" },
      { label: "Impostazioni", action: "nav-settings", accelerator: "CmdOrCtrl+3" },
      { type: "separator" },
      { label: "Cerca documenti", action: "search", accelerator: "CmdOrCtrl+K" },
      { label: "Aggiorna dati", action: "refresh", accelerator: "CmdOrCtrl+R" },
      { type: "separator" },
      { label: "Comprimi sidebar", action: "toggle-sidebar", accelerator: "CmdOrCtrl+B" },
      { label: "Scorciatoie", action: "show-shortcuts", accelerator: "CmdOrCtrl+/" },
    ],
  },
]);

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Initialize database on startup
db.getDb();
console.log("Database initialized");

// Preview chunk cache: fileId -> { mimeType, chunks[], createdAt }
const CHUNK_SIZE = 256 * 1024; // 256KB base64 per chunk (~192KB raw)
const MAX_CACHE_ENTRIES = 20;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  mimeType: string;
  chunks: string[];
  createdAt: number;
}

const previewCache = new Map<string, CacheEntry>();

/** Evict expired or excess entries from the preview cache. */
function evictPreviewCache() {
  const now = Date.now();
  // Remove expired entries
  for (const [key, entry] of previewCache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      previewCache.delete(key);
    }
  }
  // If still over limit, remove oldest entries
  while (previewCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) previewCache.delete(oldestKey);
    else break;
  }
}

// --- RPC Handlers ---
const rpc = BrowserView.defineRPC<ArkimindRPC>({
  maxRequestTime: 120_000,
  handlers: {
    requests: {
      // --- Auth ---
      getAuthStatus: () => ({ authenticated: auth.isAuthenticated() }),

      login: async () => await auth.login(),

      logout: () => {
        auth.logout();
        return { success: true };
      },

      // --- Settings ---
      getSettings: () => {
        const settings = db.getAllSettings();
        return {
          apiKey: settings["api_key"] ?? null,
          apiBaseUrl: settings["api_base_url"] ?? null,
          archiveRootFolderId: settings["archive_root_folder_id"] ?? null,
          archiveRootFolderName: settings["archive_root_folder_name"] ?? null,
        };
      },

      saveSetting: ({ key, value }) => {
        db.setSetting(key, value);
        return { success: true };
      },

      deleteSetting: ({ key }) => {
        db.deleteSetting(key);
        return { success: true };
      },

      // --- Inbox Folders ---
      getInboxFolders: () => {
        const folders = db.getInboxFolders();
        return folders.map((f) => ({
          id: f.id,
          driveFolderId: f.drive_folder_id,
          name: f.name,
        }));
      },

      addInboxFolder: ({ driveFolderId, name }) => {
        db.addInboxFolder(driveFolderId, name);
        return { success: true };
      },

      removeInboxFolder: ({ id }) => {
        db.removeInboxFolder(id);
        return { success: true };
      },

      // --- Drive ---
      listFiles: async ({ folderId }) => {
        const files = await drive.listFiles(folderId);
        return files.map((f) => {
          const doc = db.getDocumentByFileId(f.id);
          return {
            ...f,
            classificationStatus: doc?.status ?? null,
            classification: doc?.classification_json
              ? JSON.parse(doc.classification_json)
              : null,
          };
        });
      },

      browseFolders: async ({ parentId }) => {
        const folders = await drive.listFolders(parentId);
        return folders;
      },

      getFilePreview: async ({ fileId, mimeType }) => {
        try {
          const dataUrl = await drive.getFilePreview(fileId, mimeType);
          if (!dataUrl) return null;

          const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
          if (!match) return null;

          const actualMime = match[1];
          const base64 = match[2];

          const chunks: string[] = [];
          for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
            chunks.push(base64.slice(i, i + CHUNK_SIZE));
          }

          previewCache.set(fileId, { mimeType: actualMime, chunks, createdAt: Date.now() });
          evictPreviewCache();

          return { mimeType: actualMime, totalChunks: chunks.length };
        } catch (e) {
          console.error("Preview failed:", e);
          return null;
        }
      },

      getPreviewChunk: ({ fileId, chunkIndex }) => {
        const cached = previewCache.get(fileId);
        if (!cached || chunkIndex < 0 || chunkIndex >= cached.chunks.length) {
          throw new Error("Chunk not found");
        }
        const data = cached.chunks[chunkIndex];
        // Clean up if last chunk
        if (chunkIndex === cached.chunks.length - 1) {
          previewCache.delete(fileId);
        }
        return { data };
      },

      // --- Upload ---
      uploadFileFromDialog: async ({ folderId }) => {
        const result = await Utils.openFileDialog({
          allowedFileTypes: "*",
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: true,
        });

        if (!result || !Array.isArray(result) || result.length === 0) {
          return { success: true, uploaded: [] };
        }

        const uploaded: drive.DriveFile[] = [];
        for (const filePath of result) {
          const file = Bun.file(filePath);
          const bytes = new Uint8Array(await file.arrayBuffer());
          const fileName = filePath.split("/").pop() ?? "file";
          const mimeType = file.type || "application/octet-stream";
          const driveFile = await drive.uploadFile(
            folderId,
            fileName,
            mimeType,
            bytes,
          );
          uploaded.push(driveFile);
        }

        return { success: true, uploaded };
      },

      uploadFileData: async ({ folderId, fileName, mimeType, dataBase64 }) => {
        const bytes = new Uint8Array(
          Buffer.from(dataBase64, "base64"),
        );
        if (bytes.byteLength > drive.MAX_UPLOAD_SIZE) {
          const sizeMB = (bytes.byteLength / (1024 * 1024)).toFixed(1);
          const limitMB = (drive.MAX_UPLOAD_SIZE / (1024 * 1024)).toFixed(0);
          throw new Error(
            `Il file è troppo grande (${sizeMB} MB). Limite massimo: ${limitMB} MB.`,
          );
        }
        const driveFile = await drive.uploadFile(
          folderId,
          fileName,
          mimeType,
          bytes,
        );
        return { success: true, file: driveFile };
      },

      // --- Classification & Archive ---
      classifyFile: async ({ fileId }) => {
        const apiKey = db.getSetting("api_key");
        const apiBaseUrl = db.getSetting("api_base_url");

        if (!apiKey) throw new Error("API key not configured");
        if (!apiBaseUrl) throw new Error("API base URL not configured");

        const fileMeta = await drive.getFileMetadata(fileId);
        const fileBytes = await drive.downloadFile(fileId);

        const blob = new Blob([fileBytes.buffer as ArrayBuffer], { type: fileMeta.mimeType });
        const formData = new FormData();
        formData.append("file", blob, fileMeta.name);

        const classifyRes = await fetch(
          `${apiBaseUrl}/api/document-classification`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
          },
        );

        if (!classifyRes.ok) {
          const errText = await classifyRes.text();
          throw new Error(
            `Classification API error (${classifyRes.status}): ${errText}`,
          );
        }

        const classification: ClassificationResult = await classifyRes.json();

        // Preserve archived status when re-classifying
        const existingDoc = db.getDocumentByFileId(fileId);
        const wasArchived = existingDoc?.status === "archived";

        db.saveDocument({
          driveFileId: fileId,
          originalName: fileMeta.name,
          mimeType: fileMeta.mimeType,
          classificationJson: JSON.stringify(classification),
          category: classification.document_profile?.category ?? "Altro",
          entity: classification.document_profile?.entity ?? "",
          documentType: classification.document_profile?.document_type ?? "",
          documentDate: classification.document_profile?.document_date ?? "",
          isTaxRelevant:
            classification.document_profile?.is_tax_relevant ?? false,
          status: wasArchived ? "archived" : "classified",
          inboxFolderId: fileMeta.parents?.[0],
          archivedPath: existingDoc?.archived_path ?? undefined,
          archivedFilename: existingDoc?.archived_filename ?? undefined,
        });

        return { success: true, classification };
      },

      archiveFile: async ({ fileId, targetPath, targetFilename }) => {
        const normalizedPathSegments = targetPath
          .split("/")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        const normalizedTargetPath = normalizedPathSegments.join("/");
        const normalizedTargetFilename = targetFilename.trim();

        if (!normalizedTargetPath) throw new Error("targetPath is required");
        if (!normalizedTargetFilename)
          throw new Error("targetFilename is required");

        const archiveRootId = db.getSetting("archive_root_folder_id");
        if (!archiveRootId)
          throw new Error("Archive root folder not configured");

        const fileMeta = await drive.getFileMetadata(fileId);
        const currentParentId = fileMeta.parents?.[0];
        if (!currentParentId)
          throw new Error("Cannot determine file parent");

        const targetFolder = await drive.getOrCreateFolderPath(
          archiveRootId,
          normalizedPathSegments,
        );
        const targetExt = path.extname(normalizedTargetFilename);
        const sourceExt = path.extname(fileMeta.name);
        const archivedFilename =
          targetExt || !sourceExt
            ? normalizedTargetFilename
            : normalizedTargetFilename + sourceExt;
        await drive.moveFile(
          fileId,
          currentParentId,
          targetFolder.id,
          archivedFilename,
        );

        db.updateDocumentStatus(
          fileId,
          "archived",
          normalizedTargetPath,
          archivedFilename,
          archivedFilename,
        );

        return { success: true };
      },

      // --- Documents ---
      getDocuments: ({ limit }) => {
        return db.getDocuments(limit ?? 100);
      },

      searchDocuments: ({ query }) => {
        if (!query) return [];
        return db.searchDocuments(query);
      },

      deleteDocument: async ({ driveFileId, deleteDrive }) => {
        if (deleteDrive) {
          try {
            await drive.deleteFile(driveFileId);
          } catch (e) {
            console.error("Drive delete failed:", e);
            throw new Error(`Errore eliminazione da Drive: ${e}`);
          }
        }
        db.deleteDocument(driveFileId);
        return { success: true };
      },

      // --- Utils ---
      openExternal: ({ url }) => {
        if (!url) throw new Error("URL is required");
        const success = Utils.openExternal(url);
        return { success };
      },
    },
    messages: {},
  },
});

// --- Electrobun Window ---
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      // Vite not running
    }
  } else {
    const updateInfo = await Updater.checkForUpdate();
    if (updateInfo?.updateAvailable) {
      console.log("Nuovo aggiornamento canary trovato!");
      await Updater.downloadUpdate();
      if (Updater.updateInfo()?.updateReady) {
        await Updater.applyUpdate();
      }
    }
  }
  return "views://mainview/index.html";
}

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
  title: "Arkimind",
  url,
  frame: { width: 1200, height: 800, x: 100, y: 100 },
  rpc,
});

// Forward menu shortcut actions to the webview
Electrobun.events.on("application-menu-clicked", (e) => {
  const action = e.data.action;
  if (action) {
    mainWindow.webview.rpc?.send.shortcutAction({ action });
  }
});

console.log("Arkimind started!");

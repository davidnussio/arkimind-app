/**
 * API layer — delegates to Electrobun native RPC.
 * No HTTP server, no fetch, no CORS.
 */
import { electroview } from "./rpc";
import type { ClassificationResult } from "../../shared/types";

function rpc() {
  if (!electroview.rpc) {
    throw new Error("RPC not connected");
  }
  return electroview.rpc.request;
}

export const api = {
  // --- Auth ---
  getAuthStatus: () => rpc().getAuthStatus({}),
  login: () => rpc().login({}),
  logout: () => rpc().logout({}),

  // --- Settings ---
  getSettings: () => rpc().getSettings({}),
  saveSetting: (key: string, value: string) =>
    rpc().saveSetting({ key, value }),
  deleteSetting: (key: string) => rpc().deleteSetting({ key }),

  // --- Inbox Folders ---
  getInboxFolders: () => rpc().getInboxFolders({}),
  addInboxFolder: (driveFolderId: string, name: string) =>
    rpc().addInboxFolder({ driveFolderId, name }),
  removeInboxFolder: (id: number) => rpc().removeInboxFolder({ id }),

  // --- Drive ---
  listFiles: (folderId: string) => rpc().listFiles({ folderId }),
  browseFolders: (parentId?: string) => rpc().browseFolders({ parentId }),
  getFilePreview: async (fileId: string, mimeType: string) => {
    try {
      const meta = await rpc().getFilePreview({ fileId, mimeType });
      if (!meta) return null;

      const parts: string[] = [];
      for (let i = 0; i < meta.totalChunks; i++) {
        const chunk = await rpc().getPreviewChunk({ fileId, chunkIndex: i });
        parts.push(chunk.data);
      }

      const dataUrl = `data:${meta.mimeType};base64,${parts.join("")}`;
      return { dataUrl };
    } catch (e) {
      console.error("Preview failed:", e);
      return null;
    }
  },

  // --- Upload ---
  uploadFile: async (folderId: string, file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Spreading the whole file into fromCharCode overflows the call stack on
    // anything bigger than a few hundred KB, so convert in chunks.
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const dataBase64 = btoa(binary);
    return rpc().uploadFileData({
      folderId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      dataBase64,
    });
  },

  openFileDialog: (folderId: string) =>
    rpc().uploadFileFromDialog({ folderId }),

  // --- Classification & Archive ---
  classifyFile: (fileId: string) => rpc().classifyFile({ fileId }),
  archiveFile: (fileId: string, targetPath: string, targetFilename: string) =>
    rpc().archiveFile({ fileId, targetPath, targetFilename }),
  updateClassification: (fileId: string, classification: ClassificationResult) =>
    rpc().updateClassification({ fileId, classification }),

  // --- Documents ---
  getDocuments: (limit = 100) => rpc().getDocuments({ limit }),
  searchDocuments: (query: string) => rpc().searchDocuments({ query }),
  deleteDocument: (driveFileId: string, deleteDrive: boolean) =>
    rpc().deleteDocument({ driveFileId, deleteDrive }),

  // --- Utils ---
  openExternal: (url: string) => rpc().openExternal({ url }),
};

/**
 * Shared RPC type definitions for Electrobun typed RPC
 * between Bun (main process) and Webview (renderer).
 */
import type { RPCSchema } from "electrobun/bun";

// --- Domain types ---

export interface AppSettings {
  apiKey: string | null;
  apiBaseUrl: string | null;
  archiveRootFolderId: string | null;
  archiveRootFolderName: string | null;
}

export interface InboxFolder {
  id: number;
  driveFolderId: string;
  name: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  thumbnailLink?: string;
  parents?: string[];
}

// --- Classification types ---

export interface DocumentProfile {
  category: string;
  entity: string;
  document_type: string;
  document_date: string;
  is_tax_relevant: boolean;
  tax_notes?: string;
}

export interface FilingStrategy {
  full_suggested_path: string;
  suggested_filename: string;
}

export interface FinancialData {
  amount?: number;
  currency?: string;
  is_paid?: boolean;
  is_invoice?: boolean;
}

export interface AiAnalysis {
  confidence_score: number;
  needs_human_validation: boolean;
  reasoning: string;
}

export interface ClassificationResult {
  document_profile: DocumentProfile;
  filing_strategy: FilingStrategy;
  extracted_data?: {
    financial?: FinancialData | false;
  };
  ai_analysis?: AiAnalysis;
}

// --- Enriched file with classification ---

export interface EnrichedDriveFile extends DriveFileInfo {
  classificationStatus: string | null;
  classification: ClassificationResult | null;
}

export interface BrowsedFolder {
  id: string;
  name: string;
  mimeType: string;
}

export interface DocumentRecord {
  id: number;
  drive_file_id: string;
  original_name: string;
  mime_type: string | null;
  classification_json: string | null;
  category: string | null;
  entity: string | null;
  document_type: string | null;
  document_date: string | null;
  is_tax_relevant: number;
  archived_path: string | null;
  archived_filename: string | null;
  status: string;
  inbox_folder_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- RPC Schema ---

export type ArkimindRPC = {
  bun: RPCSchema<{
    requests: {
      // Auth
      getAuthStatus: { params: {}; response: { authenticated: boolean } };
      login: { params: {}; response: { success: boolean; error?: string } };
      logout: { params: {}; response: { success: boolean } };

      // Settings
      getSettings: { params: {}; response: AppSettings };
      saveSetting: {
        params: { key: string; value: string };
        response: { success: boolean };
      };
      deleteSetting: {
        params: { key: string };
        response: { success: boolean };
      };

      // Inbox Folders
      getInboxFolders: { params: {}; response: InboxFolder[] };
      addInboxFolder: {
        params: { driveFolderId: string; name: string };
        response: { success: boolean };
      };
      removeInboxFolder: {
        params: { id: number };
        response: { success: boolean };
      };

      // Drive
      listFiles: {
        params: { folderId: string };
        response: EnrichedDriveFile[];
      };
      browseFolders: {
        params: { parentId?: string };
        response: BrowsedFolder[];
      };
      getFilePreview: {
        params: { fileId: string; mimeType: string };
        response: { mimeType: string; totalChunks: number } | null;
      };
      getPreviewChunk: {
        params: { fileId: string; chunkIndex: number };
        response: { data: string };
      };

      // Upload
      uploadFileFromDialog: {
        params: { folderId: string };
        response: { success: boolean; uploaded: DriveFileInfo[] };
      };
      uploadFileData: {
        params: { folderId: string; fileName: string; mimeType: string; dataBase64: string };
        response: { success: boolean; file: DriveFileInfo };
      };

      // Classification & Archive
      classifyFile: {
        params: { fileId: string };
        response: { success: boolean; classification?: ClassificationResult; error?: string };
      };
      archiveFile: {
        params: { fileId: string; targetPath: string; targetFilename: string };
        response: { success: boolean; error?: string };
      };

      // Documents
      getDocuments: {
        params: { limit?: number };
        response: DocumentRecord[];
      };
      searchDocuments: {
        params: { query: string };
        response: DocumentRecord[];
      };
      deleteDocument: {
        params: { driveFileId: string; deleteDrive: boolean };
        response: { success: boolean };
      };

      // Utils
      openExternal: {
        params: { url: string };
        response: { success: boolean };
      };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      shortcutAction: { action: string };
    };
  }>;
};

/**
 * Google Drive service — file listing, download, move, folder operations.
 * All API calls use retry with exponential backoff for transient errors.
 */
import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { getAuthClient, type OAuth2Client } from "./auth";
import { withRetry } from "./retry";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Max file size for preview download: 50 MB */
const MAX_PREVIEW_SIZE = 50 * 1024 * 1024;

/** Max file size for upload via base64 RPC: 100 MB */
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  thumbnailLink?: string;
  parents?: string[];
}

function getDriveClient(): drive_v3.Drive {
  const auth = getAuthClient();
  if (!auth) throw new Error("Not authenticated");
  return google.drive({ version: "v3", auth });
}

/** List all files in a Drive folder. */
export async function listFiles(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    const res = await withRetry(() =>
      drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, modifiedTime, size, thumbnailLink, parents)",
        pageSize: 100,
        pageToken,
        orderBy: "modifiedTime desc",
      }),
    );
    if (res.data.files) files.push(...res.data.files);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files.map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "Unnamed",
    mimeType: f.mimeType ?? "application/octet-stream",
    modifiedTime: f.modifiedTime ?? undefined,
    size: f.size ?? undefined,
    thumbnailLink: f.thumbnailLink ?? undefined,
    parents: (f.parents as string[] | undefined) ?? [],
  }));
}

/** List only folders in a parent (for browsing). */
export async function listFolders(
  parentId?: string,
): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const parentClause = parentId
    ? `'${parentId}' in parents and`
    : "";

  const res = await withRetry(() =>
    drive.files.list({
      q: `${parentClause} mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "files(id, name, mimeType, parents)",
      pageSize: 100,
      orderBy: "name",
    }),
  );

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "Unnamed",
    mimeType: FOLDER_MIME,
    parents: (f.parents as string[] | undefined) ?? [],
  }));
}

/** Download file content as bytes. */
export async function downloadFile(fileId: string): Promise<Uint8Array> {
  const drive = getDriveClient();
  const res = await withRetry(() =>
    drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    ),
  );
  return new Uint8Array(res.data as ArrayBuffer);
}

/** Get file metadata. */
export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = getDriveClient();
  const res = await withRetry(() =>
    drive.files.get({
      fileId,
      fields: "id, name, mimeType, modifiedTime, size, thumbnailLink, parents",
    }),
  );
  return {
    id: res.data.id ?? fileId,
    name: res.data.name ?? "Unnamed",
    mimeType: res.data.mimeType ?? "application/octet-stream",
    modifiedTime: res.data.modifiedTime ?? undefined,
    size: res.data.size ?? undefined,
    thumbnailLink: res.data.thumbnailLink ?? undefined,
    parents: (res.data.parents as string[] | undefined) ?? [],
  };
}

/** Find a folder by name under a parent. */
export async function findFolder(
  name: string,
  parentId?: string,
): Promise<DriveFile | null> {
  const drive = getDriveClient();
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const res = await withRetry(() =>
    drive.files.list({
      q: `name = '${name}' and mimeType = '${FOLDER_MIME}' and trashed = false${parentClause}`,
      fields: "files(id, name, mimeType, parents)",
      pageSize: 1,
    }),
  );
  const f = res.data.files?.[0];
  if (!f) return null;
  return {
    id: f.id ?? "",
    name: f.name ?? name,
    mimeType: FOLDER_MIME,
    parents: (f.parents as string[] | undefined) ?? [],
  };
}

/** Create a folder. */
export async function createFolder(
  name: string,
  parentId: string,
): Promise<DriveFile> {
  const drive = getDriveClient();
  const res = await withRetry(() =>
    drive.files.create({
      requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: "id, name, mimeType, parents",
    }),
  );
  return {
    id: res.data.id ?? "",
    name: res.data.name ?? name,
    mimeType: FOLDER_MIME,
    parents: (res.data.parents as string[] | undefined) ?? [],
  };
}

/** Get or create a folder by name under a parent. */
export async function getOrCreateFolder(
  parentId: string,
  name: string,
): Promise<DriveFile> {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  return createFolder(name, parentId);
}

/** Create a nested folder path, returning the deepest folder. */
export async function getOrCreateFolderPath(
  rootId: string,
  segments: string[],
): Promise<DriveFile> {
  let currentParentId = rootId;
  let lastFolder: DriveFile | null = null;
  for (const segment of segments) {
    const folder = await getOrCreateFolder(currentParentId, segment);
    currentParentId = folder.id;
    lastFolder = folder;
  }
  if (!lastFolder) throw new Error("Empty path segments");
  return lastFolder;
}

/** Move and rename a file. */
export async function moveFile(
  fileId: string,
  currentParentId: string,
  newParentId: string,
  newName: string,
): Promise<void> {
  const drive = getDriveClient();
  await withRetry(() =>
    drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: currentParentId,
      requestBody: { name: newName },
      fields: "id, name, parents",
    }),
  );
}

/** Upload a file to a Drive folder. */
export async function uploadFile(
  folderId: string,
  fileName: string,
  mimeType: string,
  data: Uint8Array,
): Promise<DriveFile> {
  if (data.byteLength > MAX_UPLOAD_SIZE) {
    const sizeMB = (data.byteLength / (1024 * 1024)).toFixed(1);
    const limitMB = (MAX_UPLOAD_SIZE / (1024 * 1024)).toFixed(0);
    throw new Error(
      `Il file è troppo grande (${sizeMB} MB). Limite massimo: ${limitMB} MB.`,
    );
  }

  const drive = getDriveClient();
  const res = await withRetry(() =>
    drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: Readable.from(Buffer.from(data)),
      },
      fields: "id, name, mimeType, modifiedTime, size, parents",
    }),
  );

  return {
    id: res.data.id ?? "",
    name: res.data.name ?? fileName,
    mimeType: res.data.mimeType ?? mimeType,
    modifiedTime: res.data.modifiedTime ?? undefined,
    size: res.data.size ?? undefined,
    parents: (res.data.parents as string[] | undefined) ?? [],
  };
}

/** Permanently delete a file from Google Drive. */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await withRetry(() => drive.files.delete({ fileId }));
}

/** Get a file's thumbnail or content as a base64 data URL. */
export async function getFilePreview(
  fileId: string,
  mimeType: string,
): Promise<string | null> {
  try {
    // Check file size before downloading
    const meta = await getFileMetadata(fileId);
    const fileSize = meta.size ? parseInt(meta.size, 10) : 0;

    if (fileSize > MAX_PREVIEW_SIZE) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      throw new Error(
        `File troppo grande per l'anteprima (${sizeMB} MB). Limite: ${(MAX_PREVIEW_SIZE / (1024 * 1024)).toFixed(0)} MB.`,
      );
    }

    // For Google Docs/Sheets/etc, export as PDF
    if (mimeType.startsWith("application/vnd.google-apps.")) {
      const drive = getDriveClient();
      const res = await withRetry(() =>
        drive.files.export(
          { fileId, mimeType: "application/pdf" },
          { responseType: "arraybuffer" },
        ),
      );
      const bytes = new Uint8Array(res.data as ArrayBuffer);
      const b64 = Buffer.from(bytes).toString("base64");
      return `data:application/pdf;base64,${b64}`;
    }

    // For regular files, download the content
    const bytes = await downloadFile(fileId);
    const b64 = Buffer.from(bytes).toString("base64");
    return `data:${mimeType};base64,${b64}`;
  } catch (e) {
    console.error("Preview failed:", e);
    // Re-throw size errors so the frontend can show them
    if (e instanceof Error && e.message.includes("troppo grande")) {
      throw e;
    }
    return null;
  }
}

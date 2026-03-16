const API_BASE = "http://localhost:3457";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Auth ---
export const api = {
  getAuthStatus: () =>
    request<{ authenticated: boolean }>("/api/auth/status"),

  login: () =>
    request<{ success: boolean; error?: string }>("/api/auth/login", {
      method: "POST",
    }),

  logout: () =>
    request<{ success: boolean }>("/api/auth/logout", { method: "POST" }),

  // --- Settings ---
  getSettings: () =>
    request<{
      apiKey: string | null;
      apiBaseUrl: string | null;
      archiveRootFolderId: string | null;
      archiveRootFolderName: string | null;
    }>("/api/settings"),

  saveSetting: (key: string, value: string) =>
    request<{ success: boolean }>(`/api/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),

  deleteSetting: (key: string) =>
    request<{ success: boolean }>(`/api/settings/${key}`, {
      method: "DELETE",
    }),

  // --- Inbox Folders ---
  getInboxFolders: () =>
    request<Array<{ id: number; driveFolderId: string; name: string }>>(
      "/api/inbox-folders",
    ),

  addInboxFolder: (driveFolderId: string, name: string) =>
    request<{ success: boolean }>("/api/inbox-folders", {
      method: "POST",
      body: JSON.stringify({ driveFolderId, name }),
    }),

  removeInboxFolder: (id: number) =>
    request<{ success: boolean }>(`/api/inbox-folders/${id}`, {
      method: "DELETE",
    }),

  // --- Drive ---
  listFiles: (folderId: string) =>
    request<
      Array<{
        id: string;
        name: string;
        mimeType: string;
        modifiedTime?: string;
        size?: string;
        classificationStatus: string | null;
        classification: any | null;
      }>
    >(`/api/drive/files/${folderId}`),

  browseFolders: (parentId?: string) =>
    request<Array<{ id: string; name: string; mimeType: string }>>(
      `/api/drive/folders${parentId ? `?parentId=${parentId}` : ""}`,
    ),

  getFilePreview: (fileId: string, mimeType: string) =>
    request<{ dataUrl: string } | null>(
      `/api/drive/preview/${fileId}?mimeType=${encodeURIComponent(mimeType)}`,
    ),

  // --- Upload ---
  uploadFile: async (folderId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/drive/upload/${folderId}`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<{ success: boolean; file: any }>;
  },

  openFileDialog: (folderId: string) =>
    request<{ success: boolean; uploaded: any[] }>("/api/file-dialog", {
      method: "POST",
      body: JSON.stringify({ folderId }),
    }),

  // --- Classification ---
  classifyFile: (fileId: string) =>
    request<{ success: boolean; classification?: any; error?: string }>(
      `/api/classify/${fileId}`,
      { method: "POST" },
    ),

  archiveFile: (
    fileId: string,
    targetPath: string,
    targetFilename: string,
  ) =>
    request<{ success: boolean; error?: string }>(`/api/archive/${fileId}`, {
      method: "POST",
      body: JSON.stringify({ targetPath, targetFilename }),
    }),

  // --- Documents ---
  getDocuments: (limit = 100) =>
    request<any[]>(`/api/documents?limit=${limit}`),

  searchDocuments: (query: string) =>
    request<any[]>(`/api/documents/search?q=${encodeURIComponent(query)}`),

  deleteDocument: (driveFileId: string, deleteDrive: boolean) =>
    request<{ success: boolean }>(
      `/api/documents/${driveFileId}?deleteDrive=${deleteDrive}`,
      { method: "DELETE" },
    ),

  // --- External ---
  openExternal: (url: string) =>
    request<{ success: boolean }>("/api/open-external", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
};

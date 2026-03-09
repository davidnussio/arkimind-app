import { ApplicationMenu, BrowserWindow, Updater, Utils } from "electrobun/bun";
import * as db from "./db";
import * as auth from "./auth";
import * as drive from "./drive";

// Application menu with standard Edit roles (enables Cmd+C/V/X)
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
]);

const API_PORT = 3457;
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Initialize database on startup
db.getDb();
console.log("Database initialized");

// --- HTTP API Server ---
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function errorResponse(message: string, status = 500): Response {
  return json({ error: message }, status);
}

Bun.serve({
  port: API_PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      // --- Auth ---
      if (pathname === "/api/auth/status" && method === "GET") {
        return json({ authenticated: auth.isAuthenticated() });
      }

      if (pathname === "/api/auth/login" && method === "POST") {
        const result = await auth.login();
        return json(result);
      }

      if (pathname === "/api/auth/logout" && method === "POST") {
        auth.logout();
        return json({ success: true });
      }

      // --- Settings ---
      if (pathname === "/api/settings" && method === "GET") {
        const settings = db.getAllSettings();
        return json({
          apiKey: settings["api_key"] ?? null,
          apiBaseUrl: settings["api_base_url"] ?? null,
          archiveRootFolderId: settings["archive_root_folder_id"] ?? null,
          archiveRootFolderName: settings["archive_root_folder_name"] ?? null,
        });
      }

      if (pathname.startsWith("/api/settings/") && method === "PUT") {
        const key = pathname.replace("/api/settings/", "");
        const body = (await req.json()) as { value: string };
        db.setSetting(key, body.value);
        return json({ success: true });
      }

      if (pathname.startsWith("/api/settings/") && method === "DELETE") {
        const key = pathname.replace("/api/settings/", "");
        db.deleteSetting(key);
        return json({ success: true });
      }

      // --- Inbox Folders ---
      if (pathname === "/api/inbox-folders" && method === "GET") {
        const folders = db.getInboxFolders();
        return json(
          folders.map((f) => ({
            id: f.id,
            driveFolderId: f.drive_folder_id,
            name: f.name,
          })),
        );
      }

      if (pathname === "/api/inbox-folders" && method === "POST") {
        const body = (await req.json()) as {
          driveFolderId: string;
          name: string;
        };
        db.addInboxFolder(body.driveFolderId, body.name);
        return json({ success: true });
      }

      if (pathname.startsWith("/api/inbox-folders/") && method === "DELETE") {
        const id = parseInt(pathname.replace("/api/inbox-folders/", ""), 10);
        db.removeInboxFolder(id);
        return json({ success: true });
      }

      // --- Drive: List files ---
      if (pathname.startsWith("/api/drive/files/") && method === "GET") {
        const folderId = pathname.replace("/api/drive/files/", "");
        const files = await drive.listFiles(folderId);
        // Enrich with local classification status
        const enriched = files.map((f) => {
          const doc = db.getDocumentByFileId(f.id);
          return {
            ...f,
            classificationStatus: doc?.status ?? null,
            classification: doc?.classification_json
              ? JSON.parse(doc.classification_json)
              : null,
          };
        });
        return json(enriched);
      }

      // --- Drive: Browse folders ---
      if (pathname.startsWith("/api/drive/folders") && method === "GET") {
        const parentId = url.searchParams.get("parentId") ?? undefined;
        const folders = await drive.listFolders(parentId);
        return json(folders);
      }

      // --- Drive: File preview ---
      if (pathname.startsWith("/api/drive/preview/") && method === "GET") {
        const fileId = pathname.replace("/api/drive/preview/", "");
        const mimeType =
          url.searchParams.get("mimeType") ?? "application/octet-stream";
        const dataUrl = await drive.getFilePreview(fileId, mimeType);
        if (!dataUrl) return json(null);
        return json({ dataUrl });
      }

      // --- Drive: Upload file ---
      if (pathname.startsWith("/api/drive/upload/") && method === "POST") {
        const folderId = pathname.replace("/api/drive/upload/", "");
        const contentType = req.headers.get("content-type") ?? "";

        if (contentType.includes("multipart/form-data")) {
          const formData = await req.formData();
          const file = formData.get("file") as File | null;
          if (!file) return errorResponse("No file provided", 400);

          const bytes = new Uint8Array(await file.arrayBuffer());
          const uploaded = await drive.uploadFile(
            folderId,
            file.name,
            file.type || "application/octet-stream",
            bytes,
          );
          return json({ success: true, file: uploaded });
        }

        return errorResponse("Expected multipart/form-data", 400);
      }

      // --- File picker dialog (Electrobun) ---
      if (pathname === "/api/file-dialog" && method === "POST") {
        const body = (await req.json()) as { folderId: string };
        if (!body.folderId) return errorResponse("folderId is required", 400);

        const result = await Utils.openFileDialog({
          allowedFileTypes: "*",
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: true,
        });

        if (!result || !Array.isArray(result) || result.length === 0) {
          return json({ success: true, uploaded: [] });
        }

        const uploaded: any[] = [];
        for (const filePath of result) {
          const file = Bun.file(filePath);
          const bytes = new Uint8Array(await file.arrayBuffer());
          const fileName = filePath.split("/").pop() ?? "file";
          const mimeType = file.type || "application/octet-stream";
          const driveFile = await drive.uploadFile(
            body.folderId,
            fileName,
            mimeType,
            bytes,
          );
          uploaded.push(driveFile);
        }

        return json({ success: true, uploaded });
      }

      // --- Classify file ---
      if (pathname.startsWith("/api/classify/") && method === "POST") {
        const fileId = pathname.replace("/api/classify/", "");
        const apiKey = db.getSetting("api_key");
        const apiBaseUrl = db.getSetting("api_base_url");

        if (!apiKey) return errorResponse("API key not configured", 400);
        if (!apiBaseUrl)
          return errorResponse("API base URL not configured", 400);

        // Get file metadata and download
        const fileMeta = await drive.getFileMetadata(fileId);
        const fileBytes = await drive.downloadFile(fileId);

        // Create FormData and send to classification API
        const blob = new Blob([fileBytes], { type: fileMeta.mimeType });
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
          return errorResponse(
            `Classification API error (${classifyRes.status}): ${errText}`,
            502,
          );
        }

        const classification = await classifyRes.json();

        // Save to database
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
          status: "classified",
          inboxFolderId: fileMeta.parents?.[0],
        });

        return json({ success: true, classification });
      }

      // --- Archive file ---
      if (pathname.startsWith("/api/archive/") && method === "POST") {
        const fileId = pathname.replace("/api/archive/", "");
        const body = (await req.json()) as {
          targetPath: string;
          targetFilename: string;
        };

        const archiveRootId = db.getSetting("archive_root_folder_id");
        if (!archiveRootId)
          return errorResponse("Archive root folder not configured", 400);

        // Get file metadata for current parent
        const fileMeta = await drive.getFileMetadata(fileId);
        const currentParentId = fileMeta.parents?.[0];
        if (!currentParentId)
          return errorResponse("Cannot determine file parent", 400);

        // Create folder path and move file
        const pathSegments = body.targetPath
          .split("/")
          .filter((s) => s.length > 0);
        const targetFolder = await drive.getOrCreateFolderPath(
          archiveRootId,
          pathSegments,
        );
        await drive.moveFile(
          fileId,
          currentParentId,
          targetFolder.id,
          body.targetFilename,
        );

        // Update document status
        db.updateDocumentStatus(
          fileId,
          "archived",
          body.targetPath,
          body.targetFilename,
        );

        return json({ success: true });
      }

      // --- Documents ---
      if (pathname === "/api/documents" && method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
        return json(db.getDocuments(limit));
      }

      if (pathname === "/api/documents/search" && method === "GET") {
        const query = url.searchParams.get("q") ?? "";
        if (!query) return json([]);
        return json(db.searchDocuments(query));
      }

      // --- Open external URL ---
      if (pathname === "/api/open-external" && method === "POST") {
        const body = (await req.json()) as { url: string };
        if (!body.url) return errorResponse("URL is required", 400);
        const success = Utils.openExternal(body.url);
        return json({ success });
      }

      return errorResponse("Not found", 404);
    } catch (e) {
      console.error("API error:", e);
      return errorResponse(`${e}`, 500);
    }
  },
});

console.log(`API server running on http://localhost:${API_PORT}`);

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
      console.log("Nuovo aggiornamento canary trovato su localhost!");
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
});

console.log("Arkimind started!");

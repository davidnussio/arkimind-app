import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import {
  LogIn,
  LogOut,
  Key,
  Globe,
  FolderArchive,
  FolderPlus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { FolderBrowser } from "./FolderBrowser";
import { EmptyState } from "./EmptyState";

interface InboxFolder {
  id: number;
  driveFolderId: string;
  name: string;
}

interface Settings {
  apiKey: string | null;
  apiBaseUrl: string | null;
  archiveRootFolderId: string | null;
  archiveRootFolderName: string | null;
}

export function Settings() {
  const [authenticated, setAuthenticated] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    apiKey: null,
    apiBaseUrl: null,
    archiveRootFolderId: null,
    archiveRootFolderName: null,
  });
  const [inboxFolders, setInboxFolders] = useState<InboxFolder[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [showFolderBrowser, setShowFolderBrowser] = useState<
    "inbox" | "archive" | null
  >(null);

  const loadData = useCallback(async () => {
    try {
      const [authStatus, settingsData, folders] = await Promise.all([
        api.getAuthStatus(),
        api.getSettings(),
        api.getInboxFolders(),
      ]);
      setAuthenticated(authStatus.authenticated);
      setSettings(settingsData);
      setApiKeyInput(settingsData.apiKey ?? "");
      setApiBaseUrlInput(settingsData.apiBaseUrl ?? "");
      setInboxFolders(folders);
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogin = async () => {
    setLoading("login");
    try {
      const result = await api.login();
      if (result.success) {
        setAuthenticated(true);
        showMessage("Autenticazione completata!", "success");
      } else {
        showMessage(result.error ?? "Login fallito", "error");
      }
    } catch (e: any) {
      showMessage(e.message, "error");
    } finally {
      setLoading(null);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
    showMessage("Disconnesso", "success");
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    await api.saveSetting("api_key", apiKeyInput.trim());
    setSettings((s) => ({ ...s, apiKey: apiKeyInput.trim() }));
    showMessage("API Key salvata", "success");
  };

  const handleSaveBaseUrl = async () => {
    if (!apiBaseUrlInput.trim()) return;
    // Remove trailing slash
    const url = apiBaseUrlInput.trim().replace(/\/+$/, "");
    await api.saveSetting("api_base_url", url);
    setSettings((s) => ({ ...s, apiBaseUrl: url }));
    showMessage("URL API salvato", "success");
  };

  const handleFolderSelected = async (
    folderId: string,
    folderName: string,
  ) => {
    if (showFolderBrowser === "inbox") {
      await api.addInboxFolder(folderId, folderName);
      showMessage(`Cartella "${folderName}" aggiunta`, "success");
      loadData();
    } else if (showFolderBrowser === "archive") {
      await api.saveSetting("archive_root_folder_id", folderId);
      await api.saveSetting("archive_root_folder_name", folderName);
      setSettings((s) => ({
        ...s,
        archiveRootFolderId: folderId,
        archiveRootFolderName: folderName,
      }));
      showMessage(`Cartella archivio impostata: "${folderName}"`, "success");
    }
    setShowFolderBrowser(null);
  };

  const handleRemoveInboxFolder = async (folder: InboxFolder) => {
    await api.removeInboxFolder(folder.id);
    setInboxFolders((prev) => prev.filter((f) => f.id !== folder.id));
    showMessage(`Cartella "${folder.name}" rimossa`, "success");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Impostazioni</h2>

      {/* Status message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <XCircle className="size-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Google Account */}
      <section className="rounded-lg border border-border p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <LogIn className="size-4" /> Account Google Drive
        </h3>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              authenticated
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}
          >
            <span
              className={`size-2 rounded-full ${authenticated ? "bg-green-500" : "bg-yellow-500"}`}
            />
            {authenticated ? "Connesso" : "Non connesso"}
          </div>
          {authenticated ? (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-3.5" />
              Disconnetti
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleLogin}
              disabled={loading === "login"}
            >
              {loading === "login" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LogIn className="size-3.5" />
              )}
              Accedi con Google
            </Button>
          )}
        </div>
      </section>

      {/* API Configuration */}
      <section className="rounded-lg border border-border p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Key className="size-4" /> API di Classificazione
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Inserisci la tua API key..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" onClick={handleSaveApiKey}>
                Salva
              </Button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              <Globe className="mr-1 inline size-3" />
              URL Base API
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={apiBaseUrlInput}
                onChange={(e) => setApiBaseUrlInput(e.target.value)}
                placeholder="https://api.example.com"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" onClick={handleSaveBaseUrl}>
                Salva
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Archive Root Folder */}
      <section className="rounded-lg border border-border p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <FolderArchive className="size-4" /> Cartella Archivio
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Cartella principale su Google Drive dove archiviare i documenti
          classificati.
        </p>
        <div className="flex items-center gap-2">
          {settings.archiveRootFolderName ? (
            <span className="rounded-md bg-muted px-3 py-1.5 text-sm">
              {settings.archiveRootFolderName}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Nessuna cartella selezionata
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFolderBrowser("archive")}
            disabled={!authenticated}
          >
            {settings.archiveRootFolderName ? "Cambia" : "Seleziona"}
          </Button>
        </div>
      </section>

      {/* Inbox Folders */}
      <section className="rounded-lg border border-border p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <FolderPlus className="size-4" /> Cartelle Inbox
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Cartelle Google Drive da monitorare. I file presenti qui verranno
          mostrati nella dashboard per l'analisi.
        </p>

        {inboxFolders.length === 0 ? (
          <EmptyState
            illustration="folder"
            title="Nessuna cartella inbox configurata"
            description="Aggiungi una cartella Google Drive per iniziare a monitorare i documenti."
          />
        ) : (
          <ul className="mb-3 space-y-2">
            {inboxFolders.map((folder) => (
              <li
                key={folder.id}
                className="flex items-center justify-between rounded-md bg-muted px-3 py-2"
              >
                <span className="text-sm">{folder.name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemoveInboxFolder(folder)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFolderBrowser("inbox")}
          disabled={!authenticated}
        >
          <FolderPlus className="size-3.5" />
          Aggiungi cartella
        </Button>
      </section>

      {/* Folder Browser Modal */}
      {showFolderBrowser && (
        <FolderBrowser
          title={
            showFolderBrowser === "inbox"
              ? "Seleziona cartella inbox"
              : "Seleziona cartella archivio"
          }
          onSelect={handleFolderSelected}
          onClose={() => setShowFolderBrowser(null)}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { FolderBrowser } from "./FolderBrowser";
import {
  Archive,
  LogIn,
  Key,
  Globe,
  FolderPlus,
  FolderArchive,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = "welcome" | "auth" | "api" | "archive" | "inbox" | "done";

const STEPS: Step[] = ["welcome", "auth", "api", "archive", "inbox", "done"];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [authenticated, setAuthenticated] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [archiveName, setArchiveName] = useState<string | null>(null);
  const [inboxFolders, setInboxFolders] = useState<string[]>([]);
  const [showFolderBrowser, setShowFolderBrowser] = useState<"inbox" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const canGoBack = stepIndex > 0 && step !== "done";

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    setError(null);
    try {
      const result = await api.login();
      if (result.success) {
        setAuthenticated(true);
      } else {
        setError(result.error ?? "Login fallito");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSaveApi = async () => {
    setError(null);
    try {
      if (apiKey.trim()) await api.saveSetting("api_key", apiKey.trim());
      if (apiBaseUrl.trim()) {
        const url = apiBaseUrl.trim().replace(/\/+$/, "");
        await api.saveSetting("api_base_url", url);
      }
      goNext();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleFolderSelected = async (folderId: string, folderName: string) => {
    try {
      if (showFolderBrowser === "archive") {
        await api.saveSetting("archive_root_folder_id", folderId);
        await api.saveSetting("archive_root_folder_name", folderName);
        setArchiveName(folderName);
      } else if (showFolderBrowser === "inbox") {
        await api.addInboxFolder(folderId, folderName);
        setInboxFolders((prev) => [...prev, folderName]);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setShowFolderBrowser(null);
  };

  const handleFinish = async () => {
    await api.saveSetting("onboarding_completed", "true");
    onComplete();
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= stepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline text-xs">Chiudi</button>
          </div>
        )}

        {/* Welcome */}
        {step === "welcome" && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <Archive className="size-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">Benvenuto in Arkimind</h1>
            <p className="mt-2 text-muted-foreground">
              Configura il tuo archivio documentale intelligente in pochi passaggi.
            </p>
            <Button className="mt-8" onClick={goNext}>
              Inizia la configurazione
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Auth */}
        {step === "auth" && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
              <LogIn className="size-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold">Collega Google Drive</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Arkimind ha bisogno di accedere al tuo Google Drive per gestire i documenti.
            </p>
            <div className="mt-6">
              {authenticated ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="size-5" />
                    <span className="font-medium">Connesso</span>
                  </div>
                  <Button onClick={goNext}>
                    Continua <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button onClick={handleLogin} disabled={loginLoading}>
                  {loginLoading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  Accedi con Google
                </Button>
              )}
            </div>
            {!authenticated && (
              <button onClick={goNext} className="mt-4 text-xs text-muted-foreground underline">
                Salta per ora
              </button>
            )}
          </div>
        )}

        {/* API Config */}
        {step === "api" && (
          <div>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-900/30">
                <Key className="size-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold">API di Classificazione</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Configura il servizio AI per la classificazione automatica dei documenti.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Inserisci la tua API key..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Globe className="size-3" /> URL Base API
                </label>
                <input
                  type="url"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={goBack}><ChevronLeft className="size-4" /> Indietro</Button>
              <Button onClick={handleSaveApi}>Continua <ChevronRight className="size-4" /></Button>
            </div>
            <div className="mt-3 text-center">
              <button onClick={goNext} className="text-xs text-muted-foreground underline">Salta per ora</button>
            </div>
          </div>
        )}

        {/* Archive folder */}
        {step === "archive" && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
              <FolderArchive className="size-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold">Cartella Archivio</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Scegli la cartella principale su Google Drive dove archiviare i documenti classificati.
            </p>
            <div className="mt-6">
              {archiveName ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="rounded-md bg-muted px-3 py-1.5 text-sm">{archiveName}</span>
                  <Button variant="outline" size="sm" onClick={() => setShowFolderBrowser("archive")}>Cambia</Button>
                </div>
              ) : (
                <Button onClick={() => setShowFolderBrowser("archive")}>
                  <FolderArchive className="size-4" /> Seleziona cartella
                </Button>
              )}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={goBack}><ChevronLeft className="size-4" /> Indietro</Button>
              <Button onClick={goNext}>Continua <ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}

        {/* Inbox folders */}
        {step === "inbox" && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
              <FolderPlus className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold">Cartelle Inbox</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Aggiungi le cartelle Google Drive da monitorare per nuovi documenti.
            </p>
            {inboxFolders.length > 0 && (
              <ul className="mt-4 space-y-1">
                {inboxFolders.map((name, i) => (
                  <li key={i} className="rounded-md bg-muted px-3 py-1.5 text-sm">{name}</li>
                ))}
              </ul>
            )}
            <Button variant="outline" className="mt-4" onClick={() => setShowFolderBrowser("inbox")}>
              <FolderPlus className="size-4" /> Aggiungi cartella
            </Button>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={goBack}><ChevronLeft className="size-4" /> Indietro</Button>
              <Button onClick={goNext}>Continua <ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
              <Sparkles className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold">Tutto pronto!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Arkimind è configurato. Puoi iniziare ad analizzare e archiviare i tuoi documenti.
            </p>
            <Button className="mt-8" onClick={handleFinish}>
              Vai alla Dashboard <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Folder Browser Modal */}
        {showFolderBrowser && (
          <FolderBrowser
            title={showFolderBrowser === "inbox" ? "Seleziona cartella inbox" : "Seleziona cartella archivio"}
            onSelect={handleFolderSelected}
            onClose={() => setShowFolderBrowser(null)}
          />
        )}

        {/* Navigation with back */}
        {canGoBack && step !== "welcome" && step !== "auth" && step !== "api" && step !== "archive" && step !== "inbox" && (
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={goBack}><ChevronLeft className="size-4" /> Indietro</Button>
          </div>
        )}
      </div>
    </div>
  );
}

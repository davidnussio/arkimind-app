import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  Folder,
  FolderArchive,
  FolderPlus,
  Keyboard,
  Loader2,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Callout, Segmented, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout";
import { FolderPicker } from "@/components/FolderPicker";
import { useToast } from "@/components/Toaster";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Auth } from "@/hooks/use-auth";
import type { Inbox } from "@/hooks/use-inbox";
import type { Theme, ThemePreference } from "@/hooks/use-theme";
import type { AppSettings } from "../../shared/types";

export function isValidApiUrl(value: string): boolean {
  return /^https?:\/\/[^\s/]+/i.test(value.trim());
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-3 border-t py-7 first:border-t-0 first:pt-0 md:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </section>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border bg-card p-4 shadow-xs">{children}</div>;
}

interface SettingsPageProps {
  auth: Auth;
  onSignIn: () => void;
  inbox: Inbox;
  theme: Theme;
  version: string;
  onShowShortcuts: () => void;
}

export function SettingsPage({ auth, onSignIn, inbox, theme, version, onShowShortcuts }: SettingsPageProps) {
  const { toast, toastError } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picker, setPicker] = useState<"archive" | "inbox" | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);

  const driveReady = auth.authenticated === true;

  const chooseFolder = async (id: string, name: string) => {
    try {
      if (picker === "archive") {
        await api.saveSetting("archive_root_folder_id", id);
        await api.saveSetting("archive_root_folder_name", name);
        setSettings((s) => s && { ...s, archiveRootFolderId: id, archiveRootFolderName: name });
        toast(`Cartella archivio: «${name}»`, "success");
      } else {
        await inbox.addFolder(id, name);
        toast(`Ora Arkimind tiene d'occhio «${name}»`, "success");
      }
      setPicker(null);
    } catch (e) {
      toastError(e);
    }
  };

  const removeInbox = async (id: number, name: string) => {
    setRemoving(id);
    try {
      await api.removeInboxFolder(id);
      await inbox.reload();
      toast(`«${name}» non è più seguita. I file su Drive restano dove sono.`, "success");
    } catch (e) {
      toastError(e);
    } finally {
      setRemoving(null);
    }
  };

  const logout = async () => {
    try {
      await auth.logout();
      toast("Disconnesso da Google Drive", "success");
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Impostazioni" description="Collegamenti, cartelle e preferenze di Arkimind." />

      {loadError && (
        <Callout tone="danger" icon={AlertCircle} title="Impossibile leggere le impostazioni" className="mb-6">
          {loadError}
        </Callout>
      )}

      <SettingsSection
        title="Google Drive"
        description="Arkimind legge i file dalle cartelle che scegli e li sposta nell'archivio."
      >
        <Panel>
          {auth.authenticated === null ? (
            <Skeleton className="h-10" />
          ) : (
            <div className="flex flex-wrap items-center gap-3.5">
              <span
                className={
                  driveReady
                    ? "flex size-10 items-center justify-center rounded-lg bg-success-soft text-success"
                    : "flex size-10 items-center justify-center rounded-lg bg-warning-soft text-warning-foreground"
                }
              >
                {driveReady ? <Cloud className="size-5" /> : <CloudOff className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{driveReady ? "Collegato" : "Non collegato"}</p>
                <p className="text-xs text-muted-foreground">
                  {driveReady
                    ? "L'accesso resta attivo finché non ti disconnetti."
                    : "Accedi con l'account Google che contiene i tuoi documenti."}
                </p>
              </div>
              {driveReady ? (
                <Button variant="outline" onClick={logout}>
                  <LogOut />
                  Disconnetti
                </Button>
              ) : (
                <Button onClick={onSignIn} disabled={auth.signingIn}>
                  {auth.signingIn ? <Loader2 className="animate-spin" /> : <LogIn />}
                  Accedi con Google
                </Button>
              )}
            </div>
          )}
        </Panel>
      </SettingsSection>

      <SettingsSection
        title="Servizio di analisi"
        description="L'indirizzo e la chiave del servizio AI che legge i documenti e propone dove archiviarli."
      >
        {settings ? (
          <ApiForm
            settings={settings}
            onSaved={(next) => {
              setSettings(next);
              toast("Servizio di analisi salvato", "success");
            }}
            onError={toastError}
          />
        ) : (
          <Skeleton className="h-48 rounded-xl" />
        )}
      </SettingsSection>

      <SettingsSection
        title="Cartelle"
        description="Da dove arrivano i documenti e dove vengono archiviati, su Google Drive."
      >
        {!driveReady && auth.authenticated !== null && (
          <Callout tone="neutral" icon={CloudOff}>
            Accedi a Google Drive per scegliere le cartelle.
          </Callout>
        )}
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label>Cartella archivio</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Qui Arkimind crea le sottocartelle e sposta i documenti archiviati.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPicker("archive")} disabled={!driveReady}>
              {settings?.archiveRootFolderName ? "Cambia" : "Scegli"}
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
            <FolderArchive className="size-4 shrink-0 text-primary" />
            {settings === null ? (
              <Skeleton className="h-4 w-32" />
            ) : settings.archiveRootFolderName ? (
              <span className="font-medium">{settings.archiveRootFolderName}</span>
            ) : (
              <span className="text-muted-foreground">Non impostata: senza questa cartella non si può archiviare.</span>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label>Cartelle da archiviare</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                I file presenti qui compaiono nella sezione «Da archiviare».
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPicker("inbox")} disabled={!driveReady}>
              <FolderPlus />
              Aggiungi
            </Button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {!inbox.foldersLoaded ? (
              <Skeleton className="h-10" />
            ) : inbox.folders.length === 0 ? (
              <li className="rounded-lg border border-dashed px-3 py-3 text-center text-[0.8125rem] text-muted-foreground">
                Nessuna cartella ancora.
              </li>
            ) : (
              inbox.folders.map((folder) => (
                <li key={folder.id} className="flex items-center gap-2.5 rounded-lg bg-muted/60 py-1.5 pr-1.5 pl-3 text-sm">
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{folder.name}</span>
                  <IconButton
                    label={`Smetti di seguire «${folder.name}»`}
                    icon={Trash2}
                    busy={removing === folder.id}
                    onClick={() => removeInbox(folder.id, folder.name)}
                    className="hover:text-destructive-foreground"
                  />
                </li>
              ))
            )}
          </ul>
        </Panel>
      </SettingsSection>

      <SettingsSection title="Aspetto" description="Il tema «Sistema» segue l'impostazione di macOS.">
        <Segmented<ThemePreference>
          aria-label="Tema"
          value={theme.preference}
          onValueChange={theme.setPreference}
          options={[
            { value: "light", label: "Chiaro", icon: Sun },
            { value: "dark", label: "Scuro", icon: Moon },
            { value: "system", label: "Sistema", icon: Monitor },
          ]}
        />
      </SettingsSection>

      <SettingsSection title="Informazioni" description="Versione installata e aiuto rapido.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge tone="outline">Arkimind v{version}</Badge>
          <Button variant="ghost" size="sm" onClick={onShowShortcuts}>
            <Keyboard />
            Scorciatoie da tastiera
          </Button>
        </div>
      </SettingsSection>

      <FolderPicker
        open={picker !== null}
        title={picker === "archive" ? "Scegli la cartella archivio" : "Aggiungi una cartella da archiviare"}
        description={
          picker === "archive"
            ? "Arkimind organizzerà qui i documenti, creando le sottocartelle necessarie."
            : "I file che arrivano in questa cartella compariranno nella sezione «Da archiviare»."
        }
        disabledIds={picker === "inbox" ? inbox.folders.map((f) => f.driveFolderId) : []}
        onSelect={chooseFolder}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}

/** URL + API key for the classification service, saved together. */
export function ApiForm({
  settings,
  onSaved,
  onError,
}: {
  settings: AppSettings;
  onSaved: (next: AppSettings) => void;
  onError: (e: unknown) => void;
}) {
  const [url, setUrl] = useState(settings.apiBaseUrl ?? "");
  const [key, setKey] = useState(settings.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const normalizedUrl = url.trim().replace(/\/+$/, "");
  const dirty = normalizedUrl !== (settings.apiBaseUrl ?? "") || key.trim() !== (settings.apiKey ?? "");
  const urlValid = isValidApiUrl(url);
  const keyValid = key.trim().length > 0;
  const configured = Boolean(settings.apiBaseUrl && settings.apiKey);

  const save = async () => {
    setTouched(true);
    if (!urlValid || !keyValid) return;
    setSaving(true);
    try {
      if (normalizedUrl !== settings.apiBaseUrl) await api.saveSetting("api_base_url", normalizedUrl);
      if (key.trim() !== settings.apiKey) await api.saveSetting("api_key", key.trim());
      setUrl(normalizedUrl);
      onSaved({ ...settings, apiBaseUrl: normalizedUrl, apiKey: key.trim() });
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <Badge tone={configured ? "success" : "warning"}>{configured ? "Configurato" : "Da configurare"}</Badge>
        <div className="space-y-1.5">
          <Label htmlFor="api-url">Indirizzo del servizio</Label>
          <Input
            id="api-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.esempio.it"
            aria-invalid={touched && !urlValid}
            aria-describedby="api-url-hint"
          />
          <p
            id="api-url-hint"
            className={touched && !urlValid ? "text-xs text-destructive-foreground" : "text-xs text-muted-foreground"}
          >
            {touched && !urlValid
              ? "Inserisci un indirizzo che inizi con https:// o http://"
              : "L'indirizzo base, senza percorso: Arkimind aggiunge /api/document-classification."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="api-key">Chiave API</Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Incolla la chiave fornita dal servizio"
              className="pr-10 font-mono"
              aria-invalid={touched && !keyValid}
            />
            <IconButton
              label={showKey ? "Nascondi chiave" : "Mostra chiave"}
              icon={showKey ? EyeOff : Eye}
              size="icon-xs"
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2"
            />
          </div>
          {touched && !keyValid && <p className="text-xs text-destructive-foreground">La chiave è obbligatoria.</p>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          {!dirty && configured && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 text-success" />
              Salvato
            </span>
          )}
          <Button type="submit" disabled={!dirty || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Salva
          </Button>
        </div>
      </form>
    </Panel>
  );
}

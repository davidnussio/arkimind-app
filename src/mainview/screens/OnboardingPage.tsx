import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDashed,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  Folder,
  FolderArchive,
  FolderPlus,
  Inbox as InboxIcon,
  Loader2,
  LogIn,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Label } from "@/components/ui/input";
import { Callout } from "@/components/ui/misc";
import { FolderPicker } from "@/components/FolderPicker";
import { useToast } from "@/components/Toaster";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Auth } from "@/hooks/use-auth";
import type { Inbox } from "@/hooks/use-inbox";
import { isValidApiUrl } from "./SettingsPage";

type Step = "welcome" | "drive" | "ai" | "archive" | "inbox" | "done";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "welcome", label: "Benvenuto" },
  { id: "drive", label: "Google Drive" },
  { id: "ai", label: "Servizio di analisi" },
  { id: "archive", label: "Cartella archivio" },
  { id: "inbox", label: "Cartelle da archiviare" },
  { id: "done", label: "Pronto" },
];

interface OnboardingPageProps {
  auth: Auth;
  onSignIn: () => void;
  inbox: Inbox;
  onComplete: () => void;
}

export function OnboardingPage({ auth, onSignIn, inbox, onComplete }: OnboardingPageProps) {
  const { toastError } = useToast();
  const [step, setStep] = useState<Step>("welcome");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [archiveName, setArchiveName] = useState<string | null>(null);
  const [picker, setPicker] = useState<"archive" | "inbox" | null>(null);

  const index = STEPS.findIndex((s) => s.id === step);
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)].id);
  const back = () => setStep(STEPS[Math.max(index - 1, 0)].id);
  const driveReady = auth.authenticated === true;

  const completed: Record<Step, boolean> = {
    welcome: index > 0,
    drive: driveReady,
    ai: aiSaved,
    archive: Boolean(archiveName),
    inbox: inbox.folders.length > 0,
    done: false,
  };

  const saveAi = async () => {
    setTouched(true);
    if (!isValidApiUrl(url) || !key.trim()) return;
    setSaving(true);
    try {
      await api.saveSetting("api_base_url", url.trim().replace(/\/+$/, ""));
      await api.saveSetting("api_key", key.trim());
      setAiSaved(true);
      next();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const chooseFolder = async (id: string, name: string) => {
    try {
      if (picker === "archive") {
        await api.saveSetting("archive_root_folder_id", id);
        await api.saveSetting("archive_root_folder_name", name);
        setArchiveName(name);
      } else {
        await inbox.addFolder(id, name);
      }
      setPicker(null);
    } catch (e) {
      toastError(e);
    }
  };

  const finish = async () => {
    try {
      await api.saveSetting("onboarding_completed", "true");
    } catch {
      // the local flag below is enough to skip onboarding next time
    }
    onComplete();
  };

  const needsDrive = !driveReady && (
    <Callout
      tone="warning"
      icon={CloudOff}
      title="Serve l'accesso a Google Drive"
      action={
        <Button size="sm" variant="outline" onClick={onSignIn} disabled={auth.signingIn}>
          {auth.signingIn ? <Loader2 className="animate-spin" /> : <LogIn />}
          Accedi
        </Button>
      }
    >
      Per sfogliare le cartelle devi prima collegare il tuo account.
    </Callout>
  );

  let content: ReactNode;
  let primary: ReactNode;
  let skippable = false;

  switch (step) {
    case "welcome":
      content = (
        <StepBody
          icon={Sparkles}
          title="Benvenuto in Arkimind"
          description="Arkimind legge i documenti che arrivano nel tuo Google Drive, capisce di cosa si tratta e li archivia nella cartella giusta, con un nome chiaro."
        >
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: InboxIcon, title: "Arrivano", text: "Scansioni e allegati finiscono in una cartella di Drive." },
              { icon: Sparkles, title: "Analisi AI", text: "Categoria, ente, data e importo vengono riconosciuti." },
              { icon: FolderArchive, title: "Archiviati", text: "Ogni file viene spostato e rinominato in automatico." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-xl border bg-card p-3.5">
                <Icon className="size-4 text-primary" />
                <p className="mt-2 text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[0.8125rem] text-muted-foreground">La configurazione richiede un paio di minuti.</p>
        </StepBody>
      );
      primary = (
        <Button size="lg" onClick={next}>
          Inizia
          <ArrowRight />
        </Button>
      );
      break;

    case "drive":
      content = (
        <StepBody
          icon={Cloud}
          title="Collega Google Drive"
          description="Arkimind usa il tuo account Google per leggere i file da archiviare e spostarli nell'archivio. Si aprirà il browser per confermare l'accesso."
        >
          {driveReady ? (
            <Callout tone="success" icon={Check} title="Google Drive collegato" className="mt-6" />
          ) : (
            <Button size="lg" variant="outline" className="mt-6" onClick={onSignIn} disabled={auth.signingIn}>
              {auth.signingIn ? <Loader2 className="animate-spin" /> : <LogIn />}
              {auth.signingIn ? "In attesa del browser…" : "Accedi con Google"}
            </Button>
          )}
        </StepBody>
      );
      skippable = !driveReady;
      primary = (
        <Button size="lg" onClick={next} disabled={!driveReady}>
          Continua
          <ArrowRight />
        </Button>
      );
      break;

    case "ai":
      content = (
        <StepBody
          icon={Sparkles}
          title="Servizio di analisi"
          description="Inserisci l'indirizzo e la chiave del servizio AI che classifica i documenti. Li trovi nella tua area personale del servizio."
        >
          <form
            id="ai-form"
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveAi();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ob-url">Indirizzo del servizio</Label>
              <Input
                id="ob-url"
                type="url"
                autoComplete="off"
                spellCheck={false}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.esempio.it"
                aria-invalid={touched && !isValidApiUrl(url)}
                autoFocus
              />
              {touched && !isValidApiUrl(url) && (
                <p className="text-xs text-destructive-foreground">Inserisci un indirizzo che inizi con https://</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-key">Chiave API</Label>
              <div className="relative">
                <Input
                  id="ob-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Incolla la chiave"
                  className="pr-10 font-mono"
                  aria-invalid={touched && !key.trim()}
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
              {touched && !key.trim() && <p className="text-xs text-destructive-foreground">La chiave è obbligatoria.</p>}
            </div>
          </form>
        </StepBody>
      );
      skippable = true;
      primary = (
        <Button size="lg" type="submit" form="ai-form" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Salva e continua
          <ArrowRight />
        </Button>
      );
      break;

    case "archive":
      content = (
        <StepBody
          icon={FolderArchive}
          title="Dove vuoi l'archivio?"
          description="Scegli la cartella di Google Drive in cui Arkimind creerà le sottocartelle (per esempio Casa › Utenze › 2026) e sposterà i documenti."
        >
          <div className="mt-6 space-y-3">
            {needsDrive}
            {archiveName ? (
              <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
                <FolderArchive className="size-5 text-primary" />
                <span className="flex-1 text-sm font-medium">{archiveName}</span>
                <Button variant="outline" size="sm" onClick={() => setPicker("archive")}>
                  Cambia
                </Button>
              </div>
            ) : (
              <Button size="lg" variant="outline" onClick={() => setPicker("archive")} disabled={!driveReady}>
                <Folder />
                Scegli la cartella
              </Button>
            )}
          </div>
        </StepBody>
      );
      skippable = !archiveName;
      primary = (
        <Button size="lg" onClick={next} disabled={!archiveName}>
          Continua
          <ArrowRight />
        </Button>
      );
      break;

    case "inbox":
      content = (
        <StepBody
          icon={InboxIcon}
          title="Da dove arrivano i documenti?"
          description="Aggiungi le cartelle di Drive in cui finiscono scansioni, allegati e download. I file presenti lì compariranno in «Da archiviare»."
        >
          <div className="mt-6 space-y-3">
            {needsDrive}
            {inbox.folders.length > 0 && (
              <ul className="space-y-1.5">
                {inbox.folders.map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm">
                    <Folder className="size-4 text-muted-foreground" />
                    {f.name}
                    <Check className="ml-auto size-4 text-success" />
                  </li>
                ))}
              </ul>
            )}
            <Button size="lg" variant="outline" onClick={() => setPicker("inbox")} disabled={!driveReady}>
              <FolderPlus />
              {inbox.folders.length > 0 ? "Aggiungi un'altra cartella" : "Aggiungi cartella"}
            </Button>
          </div>
        </StepBody>
      );
      skippable = inbox.folders.length === 0;
      primary = (
        <Button size="lg" onClick={next} disabled={inbox.folders.length === 0}>
          Continua
          <ArrowRight />
        </Button>
      );
      break;

    case "done": {
      const missing = STEPS.filter((s) => s.id !== "welcome" && s.id !== "done" && !completed[s.id]);
      content = (
        <StepBody
          icon={Check}
          title={missing.length === 0 ? "Tutto pronto" : "Quasi pronto"}
          description={
            missing.length === 0
              ? "Arkimind è configurato. Trovi i documenti da archiviare nella prima sezione."
              : "Puoi iniziare subito e completare il resto quando vuoi dalle Impostazioni."
          }
        >
          <ul className="mt-6 space-y-1.5">
            {STEPS.filter((s) => s.id !== "welcome" && s.id !== "done").map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm">
                {completed[s.id] ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <CircleDashed className="size-4 text-muted-foreground" />
                )}
                <span className="flex-1">{s.label}</span>
                <span className="text-xs text-muted-foreground">{completed[s.id] ? "Fatto" : "Da completare"}</span>
              </li>
            ))}
          </ul>
        </StepBody>
      );
      primary = (
        <Button size="lg" onClick={finish}>
          Apri Arkimind
          <ArrowRight />
        </Button>
      );
      break;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)] p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border bg-card shadow-xl md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden border-r bg-muted/50 p-6 md:block">
          <div className="flex items-center gap-2.5">
            <Logo className="size-7" />
            <span className="font-semibold tracking-tight">Arkimind</span>
          </div>
          <ol className="mt-8 space-y-1" aria-label="Passaggi">
            {STEPS.map((s, i) => {
              const current = s.id === step;
              const done = completed[s.id];
              return (
                <li
                  key={s.id}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                    current ? "bg-card font-medium shadow-xs" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      done
                        ? "bg-success text-white"
                        : current
                          ? "bg-primary text-primary-foreground"
                          : "border bg-card text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  {s.label}
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="flex min-h-[34rem] flex-col">
          <div className="px-6 pt-5 text-xs text-muted-foreground md:hidden">
            Passo {index + 1} di {STEPS.length}
          </div>
          <div key={step} className="flex-1 px-8 pt-10 pb-6 md:px-12">
            {content}
          </div>
          <footer className="flex items-center gap-2 border-t bg-muted/30 px-8 py-4 md:px-12">
            {index > 0 && step !== "done" && (
              <Button variant="ghost" onClick={back}>
                <ArrowLeft />
                Indietro
              </Button>
            )}
            <div className="flex-1" />
            {skippable && (
              <Button variant="ghost" onClick={next}>
                Più tardi
              </Button>
            )}
            {primary}
          </footer>
        </div>
      </div>

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

function StepBody({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-lg animate-in fade-in-0 slide-in-from-right-2 duration-200">
      <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

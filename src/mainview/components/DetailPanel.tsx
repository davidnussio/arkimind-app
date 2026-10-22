import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronRight,
  FileText,
  Folder,
  Loader2,
  Pencil,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Callout, Skeleton } from "./ui/misc";
import { FileIcon, ReviewBadge, StatusBadge } from "./badges";
import { ClassificationDetails, Section } from "./ClassificationDetails";
import { ClassificationForm } from "./ClassificationForm";
import { EmptyState } from "./EmptyState";
import type { ClassificationResult } from "../../shared/types";
import { confidenceOf, destinationOf, needsReview, pathSegments, type Destination } from "@/lib/documents";
import { formatPercent } from "@/lib/format";

const FORM_ID = "classification-form";

function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`${className ?? ""} animate-spin`} />;
}

export function PathTrail({ path, muted }: { path: string; muted?: boolean }) {
  const segments = pathSegments(path);
  return (
    <span className={muted ? "text-muted-foreground" : undefined}>
      {segments.map((segment, i) => (
        <span key={i} className="inline">
          {i > 0 && <ChevronRight className="mx-0.5 inline size-3 align-[-1px] text-muted-foreground/60" />}
          {segment}
        </span>
      ))}
    </span>
  );
}

function DestinationBox({
  destination,
  extension,
  muted,
}: {
  destination: Destination;
  /** Shown after names that have none: the backend keeps the original extension. */
  extension?: string;
  muted?: boolean;
}) {
  const showExtension = extension && !/\.[^./]+$/.test(destination.filename);
  return (
    <div className={muted ? "rounded-xl border border-dashed p-3.5" : "rounded-xl border bg-card p-3.5"}>
      <div className="flex items-start gap-2.5 text-sm">
        <Folder className="mt-0.5 size-4 shrink-0 text-primary" />
        <PathTrail path={destination.path} muted={muted} />
      </div>
      <div className="mt-1.5 flex items-start gap-2.5 text-sm">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium break-all">
          {destination.filename}
          {showExtension && <span className="font-normal text-muted-foreground">{extension}</span>}
        </span>
      </div>
    </div>
  );
}

interface DetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Identity of the file shown; leaving edit mode when it changes. */
  fileId: string;
  name: string;
  mimeType?: string | null;
  meta: string[];
  status: string | null;
  classification: ClassificationResult | null;
  /** Where the document currently lives in the archive, if archived. */
  currentLocation?: Destination | null;
  analyzing?: boolean;
  onAnalyze?: () => void;
  /** Saves a corrected classification; resolves to false when it failed (the caller reports why). */
  onSave?: (classification: ClassificationResult) => Promise<boolean>;
  /** Actions for the file, given the destination the AI (or the user) proposes. */
  footer: (destination: Destination | null) => ReactNode;
}

/**
 * Side panel with everything known about one file: what the AI understood,
 * where it will be (or is) archived, and the actions for it. With `onSave`
 * the classification can be corrected and confirmed.
 */
export function DetailPanel({
  open,
  onOpenChange,
  fileId,
  name,
  mimeType,
  meta,
  status,
  classification,
  currentLocation,
  analyzing,
  onAnalyze,
  onSave,
  footer,
}: DetailPanelProps) {
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = editingFile === fileId && classification !== null;

  const suggested = destinationOf(classification);
  const extension = /\.[^.]+$/.exec(name)?.[0];
  const review = needsReview(classification);
  const score = confidenceOf(classification);
  const showSuggestion =
    suggested &&
    (!currentLocation ||
      currentLocation.path.replace(/\/+$/, "") !== suggested.path ||
      currentLocation.filename.replace(/\.[^.]+$/, "") !== suggested.filename.replace(/\.[^.]+$/, ""));

  const save = async (updated: ClassificationResult) => {
    if (!onSave) return;
    setSaving(true);
    try {
      if (await onSave(updated)) setEditingFile(null);
    } finally {
      setSaving(false);
    }
  };

  const editButton = onSave && classification && !editing && (
    <Button variant="ghost" size="xs" onClick={() => setEditingFile(fileId)}>
      <Pencil />
      Modifica
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          // Focus the panel itself rather than its first button (no stray focus ring).
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <header className="flex items-start gap-3.5 border-b px-5 pt-5 pb-4 pr-12">
          <FileIcon mimeType={mimeType} name={name} size="lg" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[0.9375rem] leading-snug font-semibold break-all">{name}</SheetTitle>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={status} />
              {review && <ReviewBadge />}
              {classification?.user_verified && (
                <Badge tone="success">
                  <UserCheck />
                  Verificato da te
                </Badge>
              )}
            </div>
            {meta.length > 0 && (
              <SheetDescription className="mt-2 text-xs text-muted-foreground">{meta.join(" · ")}</SheetDescription>
            )}
          </div>
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {!classification ? (
            analyzing ? (
              <div className="space-y-4" aria-busy="true">
                <Callout tone="info" icon={Spinner} title="Analisi in corso…">
                  L'AI sta leggendo il documento. Di solito servono pochi secondi.
                </Callout>
                <Skeleton className="h-24" />
                <Skeleton className="h-32" />
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="Non ancora analizzato"
                description="Avvia l'analisi per ottenere categoria, dati principali e una destinazione nell'archivio."
                action={
                  onAnalyze && (
                    <Button onClick={onAnalyze}>
                      <Sparkles />
                      Analizza ora
                    </Button>
                  )
                }
              />
            )
          ) : editing ? (
            <>
              <Callout tone="neutral" icon={Pencil}>
                Correggi ciò che l'AI ha sbagliato. Le modifiche vengono salvate in Arkimind e usate per
                l'archiviazione; una nuova analisi le sostituisce.
              </Callout>
              <ClassificationForm
                key={fileId}
                id={FORM_ID}
                classification={classification}
                onSubmit={save}
              />
            </>
          ) : (
            <>
              {review && (
                <Callout
                  tone="warning"
                  icon={AlertTriangle}
                  title="Da verificare"
                  action={
                    onSave && (
                      <div className="flex flex-col gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditingFile(fileId)}>
                          <Pencil />
                          Correggi
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => save({ ...classification, user_verified: true })}
                        >
                          {saving ? <Loader2 className="animate-spin" /> : <Check />}
                          Va bene così
                        </Button>
                      </div>
                    )
                  }
                >
                  L'AI non è sicura di questa classificazione
                  {score != null && ` (confidenza ${formatPercent(score)})`}. Controlla i dati e la destinazione
                  prima di archiviare.
                </Callout>
              )}

              <Section title={currentLocation ? "Posizione nell'archivio" : "Destinazione"} action={editButton}>
                {currentLocation && <DestinationBox destination={currentLocation} />}
                {currentLocation && showSuggestion && suggested && (
                  <>
                    <div className="flex items-center gap-2 pl-3.5 text-xs text-muted-foreground">
                      <ArrowDown className="size-3.5" />
                      {classification.user_verified
                        ? "Hai indicato una posizione diversa"
                        : "L'ultima analisi suggerisce una posizione diversa"}
                    </div>
                    <DestinationBox destination={suggested} extension={extension} muted />
                  </>
                )}
                {!currentLocation &&
                  (suggested ? (
                    <DestinationBox destination={suggested} extension={extension} />
                  ) : (
                    <Callout tone="neutral">L'analisi non ha proposto una destinazione.</Callout>
                  ))}
              </Section>

              <ClassificationDetails classification={classification} documentAction={editButton} />
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-5 py-3">
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditingFile(null)} disabled={saving}>
                Annulla
              </Button>
              <div className="flex-1" />
              <Button type="submit" form={FORM_ID} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Check />}
                Salva modifiche
              </Button>
            </>
          ) : (
            footer(suggested)
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}

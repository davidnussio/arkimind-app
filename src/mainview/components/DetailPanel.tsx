import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ChevronRight, FileText, Folder, Loader2, Pencil, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { Callout, Skeleton } from "./ui/misc";
import { Input, Label } from "./ui/input";
import { FileIcon, ReviewBadge, StatusBadge } from "./badges";
import { ClassificationDetails, Section } from "./ClassificationDetails";
import { EmptyState } from "./EmptyState";
import type { ClassificationResult } from "../../shared/types";
import { confidenceOf, destinationOf, needsReview, pathSegments, type Destination } from "@/lib/documents";
import { formatPercent } from "@/lib/format";

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
  /** Identity of the file shown; resets the destination draft when it changes. */
  fileId: string;
  name: string;
  mimeType?: string | null;
  meta: string[];
  status: string | null;
  classification: ClassificationResult | null;
  /** Where the document currently lives in the archive, if archived. */
  currentLocation?: Destination | null;
  /** Lets the user correct the suggested destination before archiving. */
  editableDestination?: boolean;
  analyzing?: boolean;
  onAnalyze?: () => void;
  footer: (destination: Destination | null) => ReactNode;
}

/**
 * Side panel with everything known about one file: what the AI understood,
 * where it will be (or is) archived, and the actions for it.
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
  editableDestination,
  analyzing,
  onAnalyze,
  footer,
}: DetailPanelProps) {
  const suggested = destinationOf(classification);
  const draftKey = `${fileId}|${suggested?.path}|${suggested?.filename}`;
  const [draft, setDraft] = useState<{ key: string; value: Destination | null; editing: boolean }>({
    key: draftKey,
    value: suggested,
    editing: false,
  });
  // Reset the draft when another file or a new classification is shown.
  if (draft.key !== draftKey) setDraft({ key: draftKey, value: suggested, editing: false });

  const destination =
    draft.value && draft.value.path.trim() && draft.value.filename.trim()
      ? { path: draft.value.path.trim(), filename: draft.value.filename.trim() }
      : null;
  const extension = /\.[^.]+$/.exec(name)?.[0];
  const review = needsReview(classification);
  const score = confidenceOf(classification);
  const edited =
    destination && suggested && (destination.path !== suggested.path || destination.filename !== suggested.filename);
  const showSuggestion =
    suggested &&
    (!currentLocation ||
      currentLocation.path.replace(/\/+$/, "") !== suggested.path ||
      currentLocation.filename.replace(/\.[^.]+$/, "") !== suggested.filename.replace(/\.[^.]+$/, ""));

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
          ) : (
            <>
              {review && (
                <Callout tone="warning" icon={AlertTriangle} title="Da verificare">
                  L'AI non è sicura di questa classificazione
                  {score != null && ` (confidenza ${formatPercent(score)})`}. Controlla i dati e la destinazione
                  prima di archiviare.
                </Callout>
              )}

              <Section
                title={currentLocation ? "Posizione nell'archivio" : "Destinazione"}
                action={
                  editableDestination &&
                  suggested &&
                  !draft.editing && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setDraft((d) => ({ ...d, editing: true }))}
                    >
                      <Pencil />
                      Modifica
                    </Button>
                  )
                }
              >
                {currentLocation && <DestinationBox destination={currentLocation} />}
                {currentLocation && showSuggestion && suggested && (
                  <>
                    <div className="flex items-center gap-2 pl-3.5 text-xs text-muted-foreground">
                      <ArrowDown className="size-3.5" />
                      L'ultima analisi suggerisce una posizione diversa
                    </div>
                    <DestinationBox destination={suggested} extension={extension} muted />
                  </>
                )}
                {!currentLocation &&
                  (draft.editing && draft.value ? (
                    <div className="space-y-3 rounded-xl border bg-card p-3.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="dest-path">Cartella</Label>
                        <Input
                          id="dest-path"
                          value={draft.value.path}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, value: d.value && { ...d.value, path: e.target.value } }))
                          }
                          aria-invalid={!draft.value.path.trim()}
                        />
                        <p className="text-xs text-muted-foreground">
                          Separa le sottocartelle con «/». Quelle mancanti vengono create nell'archivio.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dest-name">Nome file</Label>
                        <Input
                          id="dest-name"
                          value={draft.value.filename}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, value: d.value && { ...d.value, filename: e.target.value } }))
                          }
                          aria-invalid={!draft.value.filename.trim()}
                        />
                        <p className="text-xs text-muted-foreground">L'estensione originale viene mantenuta.</p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDraft({ key: draftKey, value: suggested, editing: false })}
                        >
                          Ripristina proposta
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!destination}
                          onClick={() => setDraft((d) => ({ ...d, editing: false }))}
                        >
                          Fatto
                        </Button>
                      </div>
                    </div>
                  ) : destination ? (
                    <>
                      <DestinationBox destination={destination} extension={extension} />
                      {edited && (
                        <p className="pl-1 text-xs text-muted-foreground">
                          Modificata da te: verrà usata per questa archiviazione.
                        </p>
                      )}
                    </>
                  ) : (
                    <Callout tone="neutral">L'analisi non ha proposto una destinazione.</Callout>
                  ))}
              </Section>

              <ClassificationDetails classification={classification} />
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-5 py-3">
          {footer(currentLocation ? suggested : destination)}
        </footer>
      </SheetContent>
    </Sheet>
  );
}

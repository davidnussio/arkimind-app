import { useState } from "react";
import { AlertCircle, Ban, CheckCircle2, ChevronDown, Circle, Loader2, Square, X } from "lucide-react";
import { Button } from "./ui/button";
import type { Activity } from "@/hooks/use-activity";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const ITEM_ICONS = {
  pending: <Circle className="size-3.5 text-muted-foreground/50" />,
  running: <Loader2 className="size-3.5 animate-spin text-primary" />,
  done: <CheckCircle2 className="size-3.5 text-success" />,
  error: <AlertCircle className="size-3.5 text-destructive" />,
  skipped: <Ban className="size-3.5 text-muted-foreground" />,
};

/** Docked, non-blocking progress for batch operations and uploads. */
export function ActivityPanel({
  activity,
  onStop,
  onDismiss,
}: {
  activity: Activity | null;
  onStop: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  if (!activity) return null;

  const done = activity.items.filter((i) => i.status === "done").length;
  const errors = activity.items.filter((i) => i.status === "error").length;
  const skipped = activity.items.filter((i) => i.status === "skipped").length;
  const total = activity.items.length;
  const processed = done + errors + skipped;
  const percent = total ? Math.round((processed / total) * 100) : 0;

  const headline = activity.running
    ? activity.stopping
      ? "Interruzione dopo il file in corso…"
      : `${processed} di ${total}`
    : errors > 0
      ? `Completato con ${plural(errors, "errore", "errori")}`
      : skipped > 0
        ? `Interrotto: ${done} di ${total} completati`
        : `Completato: ${plural(done, "file", "file")}`;

  return (
    <section
      aria-label={activity.title}
      className="fixed right-5 bottom-5 z-40 w-[22rem] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 slide-in-from-bottom-3"
    >
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
        <div className="shrink-0">
          {activity.running ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : errors > 0 ? (
            <AlertCircle className="size-4 text-warning" />
          ) : (
            <CheckCircle2 className="size-4 text-success" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{activity.title}</p>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {headline}
          </p>
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={expanded ? "Nascondi dettagli" : "Mostra dettagli"}
          aria-expanded={expanded}
        >
          <ChevronDown className={cn("size-4 transition-transform", !expanded && "-rotate-90")} />
        </button>
        {!activity.running && (
          <button
            onClick={onDismiss}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Chiudi"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="px-4 pb-3">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={processed}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              activity.running ? "bg-primary" : errors > 0 ? "bg-warning" : "bg-success",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {expanded && (
        <ul className="scrollbar-thin max-h-56 space-y-0.5 overflow-y-auto border-t px-2 py-2">
          {activity.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-xs">
              <span className="mt-px">{ITEM_ICONS[item.status]}</span>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate", item.status === "skipped" && "text-muted-foreground")}>{item.name}</p>
                {item.error && <p className="mt-0.5 line-clamp-2 text-destructive-foreground">{item.error}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {activity.running && (
        <div className="flex justify-end border-t bg-muted/40 px-3 py-2">
          <Button variant="ghost" size="sm" onClick={onStop} disabled={activity.stopping}>
            <Square className="size-3 fill-current" />
            Interrompi
          </Button>
        </div>
      )}
    </section>
  );
}

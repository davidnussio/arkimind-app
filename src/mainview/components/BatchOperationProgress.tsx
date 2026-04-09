import { Loader2, X, CheckCircle2, AlertCircle, Ban } from "lucide-react";
import { Button } from "./ui/button";

export interface BatchItemStatus {
  id: string;
  name: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  error?: string;
}

interface BatchOperationProgressProps {
  title: string;
  items: BatchItemStatus[];
  onStop: () => void;
  onClose: () => void;
  running: boolean;
}

export function BatchOperationProgress({
  title,
  items,
  onStop,
  onClose,
  running,
}: BatchOperationProgressProps) {
  const completed = items.filter((i) => i.status === "done").length;
  const errors = items.filter((i) => i.status === "error").length;
  const skipped = items.filter((i) => i.status === "skipped").length;
  const total = items.length;
  const processed = completed + errors + skipped;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            {running && <Loader2 className="size-4 animate-spin text-blue-500" />}
            {!running && errors === 0 && <CheckCircle2 className="size-4 text-green-500" />}
            {!running && errors > 0 && <AlertCircle className="size-4 text-yellow-500" />}
            <h3 className="text-sm font-medium">{title}</h3>
          </div>
          {!running && (
            <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{processed} di {total} completati</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                running ? "bg-blue-500" : errors > 0 ? "bg-yellow-500" : "bg-green-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          {/* Summary counters */}
          <div className="mt-2 flex gap-3 text-xs">
            {completed > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-3" />{completed} completati
              </span>
            )}
            {errors > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertCircle className="size-3" />{errors} errori
              </span>
            )}
            {skipped > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Ban className="size-3" />{skipped} saltati
              </span>
            )}
          </div>
        </div>

        {/* Items list */}
        <div className="max-h-60 overflow-y-auto px-4 py-3">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs">
                {item.status === "pending" && <span className="size-3 rounded-full border border-muted-foreground/30" />}
                {item.status === "running" && <Loader2 className="size-3 animate-spin text-blue-500" />}
                {item.status === "done" && <CheckCircle2 className="size-3 text-green-500" />}
                {item.status === "error" && <AlertCircle className="size-3 text-red-500" />}
                {item.status === "skipped" && <Ban className="size-3 text-muted-foreground" />}
                <span className={`flex-1 truncate ${
                  item.status === "error" ? "text-red-600 dark:text-red-400" :
                  item.status === "skipped" ? "text-muted-foreground" : ""
                }`}>
                  {item.name}
                </span>
                {item.error && (
                  <span className="truncate text-red-500 max-w-[200px]" title={item.error}>
                    {item.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3 flex justify-end gap-2">
          {running ? (
            <Button variant="destructive" size="sm" onClick={onStop}>
              <X className="size-3.5" />
              Interrompi
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onClose}>
              Chiudi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

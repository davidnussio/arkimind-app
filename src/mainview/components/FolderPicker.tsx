import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, Folder, FolderOpen, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/misc";
import { Badge } from "./ui/badge";
import { EmptyState } from "./EmptyState";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrowsedFolder } from "../../shared/types";

interface Crumb {
  id: string | undefined;
  name: string;
}

interface FolderPickerProps {
  open: boolean;
  title: string;
  description: string;
  /** Folders that can't be picked again (e.g. inbox folders already added). */
  disabledIds?: string[];
  onSelect: (folderId: string, folderName: string) => Promise<void> | void;
  onClose: () => void;
}

/** Google Drive folder chooser: click to select, double-click (or ›) to open. */
export function FolderPicker(props: FolderPickerProps) {
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-w-xl">{props.open && <FolderPickerBody {...props} />}</DialogContent>
    </Dialog>
  );
}

function FolderPickerBody({ title, description, disabledIds = [], onSelect, onClose }: FolderPickerProps) {
  const [trail, setTrail] = useState<Crumb[]>([{ id: undefined, name: "Il mio Drive" }]);
  const [folders, setFolders] = useState<BrowsedFolder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BrowsedFolder | null>(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const current = trail[trail.length - 1];

  useEffect(() => {
    let cancelled = false;
    setFolders(null);
    setError(null);
    setSelected(null);
    api
      .browseFolders(current.id)
      .then((result) => !cancelled && setFolders(result))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [current.id, attempt]);

  const target = selected ?? (current.id ? { id: current.id, name: current.name } : null);
  const targetDisabled = target ? disabledIds.includes(target.id) : true;

  const confirm = async () => {
    if (!target || targetDisabled) return;
    setSaving(true);
    try {
      await onSelect(target.id, target.name);
    } finally {
      setSaving(false);
    }
  };

  const enter = (folder: BrowsedFolder) => setTrail((t) => [...t, { id: folder.id, name: folder.name }]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <nav aria-label="Percorso" className="flex flex-wrap items-center gap-0.5 border-y bg-muted/40 px-4 py-2 text-sm">
        {trail.map((crumb, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground/60" />}
            <button
              onClick={() => setTrail((t) => t.slice(0, i + 1))}
              disabled={i === trail.length - 1}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-0.5",
                i === trail.length - 1 ? "font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {i === 0 && <HardDrive className="size-3.5" />}
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="scrollbar-thin h-72 overflow-y-auto p-2" role="listbox" aria-label="Cartelle">
        {error ? (
          <EmptyState
            size="sm"
            tone="danger"
            icon={AlertCircle}
            title="Impossibile leggere le cartelle"
            description={error}
            action={
              <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
                <RefreshCw />
                Riprova
              </Button>
            }
          />
        ) : folders === null ? (
          <div className="space-y-1 p-1" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9" style={{ width: `${85 - i * 9}%` }} />
            ))}
          </div>
        ) : folders.length === 0 ? (
          <EmptyState
            size="sm"
            icon={FolderOpen}
            title="Nessuna sottocartella"
            description={current.id ? `Puoi usare «${current.name}» così com'è.` : "Il tuo Drive non contiene cartelle."}
          />
        ) : (
          folders.map((folder) => {
            const isSelected = selected?.id === folder.id;
            const already = disabledIds.includes(folder.id);
            return (
              <div
                key={folder.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => setSelected(folder)}
                onDoubleClick={() => enter(folder)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") enter(folder);
                  if (e.key === " ") {
                    e.preventDefault();
                    setSelected(folder);
                  }
                }}
                className={cn(
                  "group flex h-10 cursor-default items-center gap-3 rounded-lg px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <Folder
                  className={cn("size-4 shrink-0", isSelected ? "fill-primary/15 text-primary" : "text-muted-foreground")}
                />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                {already && <Badge tone="neutral">Già aggiunta</Badge>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    enter(folder);
                  }}
                  tabIndex={-1}
                  className="rounded-md p-1 text-muted-foreground opacity-60 group-hover:opacity-100 hover:bg-background hover:text-foreground"
                  aria-label={`Apri ${folder.name}`}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <DialogFooter className="justify-between">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {target ? (
            <>
              Selezionata: <span className="font-medium text-foreground">{target.name}</span>
            </>
          ) : (
            "Seleziona una cartella"
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={confirm} disabled={!target || targetDisabled || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Usa questa cartella
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

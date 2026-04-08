import { Button } from "./ui/button";
import { Archive, FolderTree, FileText, Loader2, X } from "lucide-react";
import { useEffect } from "react";

interface ArchiveConfirmDialogProps {
  fileName: string;
  targetPath: string;
  targetFilename: string;
  onConfirm: () => void;
  onCancel: () => void;
  archiving: boolean;
}

export function ArchiveConfirmDialog({
  fileName,
  targetPath,
  targetFilename,
  onConfirm,
  onCancel,
  archiving,
}: ArchiveConfirmDialogProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !archiving) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel, archiving]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => !archiving && onCancel()}>
      <div className="mx-4 w-full max-w-md rounded-xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">Conferma archiviazione</h3>
          <Button variant="ghost" size="icon-xs" onClick={onCancel} disabled={archiving}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Stai per spostare il file nella cartella archivio:
          </p>
          <div className="rounded-md bg-muted/50 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 size-3.5 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground">File originale:</span>
                <p className="text-sm font-medium">{fileName}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FolderTree className="mt-0.5 size-3.5 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground">Destinazione:</span>
                <p className="font-mono text-sm">{targetPath}/{targetFilename}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={archiving}>
            Annulla
          </Button>
          <Button size="sm" className="flex-1" onClick={onConfirm} disabled={archiving}>
            {archiving ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
            Archivia
          </Button>
        </div>
      </div>
    </div>
  );
}

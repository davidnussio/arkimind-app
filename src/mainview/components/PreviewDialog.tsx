import { useCallback, useRef, useState } from "react";
import { ExternalLink, EyeOff, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { EmptyState } from "./EmptyState";
import { FileIcon } from "./badges";
import { api } from "@/lib/api";
import { driveFileUrl } from "@/lib/documents";

interface PreviewTarget {
  fileId: string;
  mimeType: string;
  name: string;
}

type PreviewState = { status: "loading" } | { status: "ready"; dataUrl: string } | { status: "error" };

/** Opens a file preview on top of whatever is on screen (including the detail panel). */
export function usePreview() {
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const requestRef = useRef(0);

  const show = useCallback(async (fileId: string, mimeType: string | null | undefined, name: string) => {
    const request = ++requestRef.current;
    const mime = mimeType || "application/octet-stream";
    setTarget({ fileId, mimeType: mime, name });
    setState({ status: "loading" });
    const result = await api.getFilePreview(fileId, mime);
    if (request !== requestRef.current) return;
    setState(result ? { status: "ready", dataUrl: result.dataUrl } : { status: "error" });
  }, []);

  const close = useCallback(() => {
    requestRef.current++;
    setTarget(null);
  }, []);

  const element = <PreviewDialog target={target} state={state} onClose={close} />;
  return { show, element };
}

function PreviewDialog({
  target,
  state,
  onClose,
}: {
  target: PreviewTarget | null;
  state: PreviewState;
  onClose: () => void;
}) {
  const openInDrive = () => target && api.openExternal(driveFileUrl(target.fileId));
  const kind =
    state.status === "ready"
      ? state.dataUrl.startsWith("data:image/")
        ? "image"
        : state.dataUrl.startsWith("data:application/pdf")
          ? "pdf"
          : "other"
      : null;

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="h-[min(88vh,960px)] max-h-none max-w-5xl gap-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <div className="flex items-center gap-3 border-b px-5 py-3.5 pr-14">
          <FileIcon mimeType={target?.mimeType} name={target?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm">{target?.name}</DialogTitle>
            <DialogDescription className="sr-only">Anteprima del documento</DialogDescription>
          </div>
          <Button variant="outline" size="sm" onClick={openInDrive}>
            <ExternalLink />
            Apri in Drive
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/50 p-4">
          {state.status === "loading" && (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground" aria-busy="true">
              <Loader2 className="size-6 animate-spin" />
              Caricamento anteprima…
            </div>
          )}
          {state.status === "ready" && kind === "image" && (
            <img
              src={state.dataUrl}
              alt={target?.name ?? ""}
              className="max-h-full max-w-full rounded-md object-contain shadow-md"
            />
          )}
          {state.status === "ready" && kind === "pdf" && (
            <iframe src={state.dataUrl} className="h-full w-full rounded-md border bg-white" title={target?.name} />
          )}
          {(state.status === "error" || kind === "other") && (
            <EmptyState
              icon={EyeOff}
              title={kind === "other" ? "Anteprima non disponibile" : "Impossibile caricare l'anteprima"}
              description={
                kind === "other"
                  ? "Questo tipo di file non si può visualizzare in Arkimind."
                  : "Il file potrebbe essere troppo grande o non più disponibile su Drive."
              }
              action={
                <Button variant="outline" onClick={openInDrive}>
                  <ExternalLink />
                  Apri in Google Drive
                </Button>
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

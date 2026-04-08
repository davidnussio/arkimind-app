import { useEffect } from "react";
import { Button } from "./ui/button";
import { X, Loader2 } from "lucide-react";

interface PreviewModalProps {
  name: string;
  mimeType: string;
  dataUrl: string | null;
  loading: boolean;
  onClose: () => void;
}

export function PreviewModal({ name, mimeType, dataUrl, loading, onClose }: PreviewModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="mx-4 flex h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="truncate text-sm font-medium">{name}</h3>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : dataUrl ? (
            mimeType.startsWith("image/") ? (
              <img src={dataUrl} alt={name} className="mx-auto max-h-full max-w-full object-contain" />
            ) : mimeType === "application/pdf" ? (
              <iframe src={dataUrl} className="h-full w-full rounded border" title={name} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Anteprima non disponibile per questo tipo di file
              </div>
            )
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Impossibile caricare l'anteprima
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

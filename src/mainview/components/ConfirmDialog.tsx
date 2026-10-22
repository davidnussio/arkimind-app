import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

export interface ConfirmRequest {
  title: string;
  description: ReactNode;
  details?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Optional narrower alternative, shown before the main button. */
  secondary?: { label: string; onConfirm: () => void };
}

/** Generic confirmation for operations that touch many files or can't be undone. */
export function ConfirmDialog({
  request,
  busy,
  onClose,
}: {
  request: ConfirmRequest | null;
  busy?: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        {request && (
          <>
            <DialogHeader>
              <DialogTitle>{request.title}</DialogTitle>
              <DialogDescription>{request.description}</DialogDescription>
            </DialogHeader>
            {request.details && <DialogBody className="pb-4">{request.details}</DialogBody>}
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Annulla
              </Button>
              {request.secondary && (
                <Button variant="outline" onClick={request.secondary.onConfirm} disabled={busy}>
                  {request.secondary.label}
                </Button>
              )}
              <Button
                variant={request.destructive ? "destructive" : "default"}
                onClick={() => request.onConfirm()}
                disabled={busy}
                autoFocus
              >
                {busy && <Loader2 className="animate-spin" />}
                {request.confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

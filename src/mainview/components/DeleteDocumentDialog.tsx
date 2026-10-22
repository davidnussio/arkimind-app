import { useState } from "react";
import { Database, Loader2, Trash2 } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type Mode = "local" | "drive";

/** Asks whether to forget the document in Arkimind only, or also delete it from Drive. */
export function DeleteDocumentDialog({
  name,
  open,
  deleting,
  onDelete,
  onClose,
}: {
  name: string;
  open: boolean;
  deleting: boolean;
  onDelete: (deleteFromDrive: boolean) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("local");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !deleting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminare il documento?</DialogTitle>
          <DialogDescription className="break-all">{name}</DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-5">
          <RadioGroup.Root
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            className="space-y-2"
            aria-label="Cosa eliminare"
          >
            <Option
              value="local"
              selected={mode === "local"}
              icon={Database}
              title="Rimuovi solo da Arkimind"
              description="Il file resta su Google Drive. Puoi farlo ricomparire analizzandolo di nuovo."
            />
            <Option
              value="drive"
              selected={mode === "drive"}
              danger
              icon={Trash2}
              title="Elimina anche da Google Drive"
              description="Il file viene cancellato definitivamente da Drive. Non si può annullare."
            />
          </RadioGroup.Root>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Annulla
          </Button>
          <Button variant="destructive" onClick={() => onDelete(mode === "drive")} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {mode === "drive" ? "Elimina definitivamente" : "Rimuovi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Option({
  value,
  selected,
  danger,
  icon: Icon,
  title,
  description,
}: {
  value: Mode;
  selected: boolean;
  danger?: boolean;
  icon: typeof Trash2;
  title: string;
  description: string;
}) {
  return (
    <RadioGroup.Item
      value={value}
      className={cn(
        "flex w-full cursor-default items-start gap-3 rounded-xl border p-3.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        selected
          ? danger
            ? "border-destructive/60 bg-destructive-soft"
            : "border-primary bg-accent/60"
          : "hover:bg-muted/60",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? (danger ? "border-destructive" : "border-primary") : "border-input",
        )}
      >
        <RadioGroup.Indicator className={cn("size-1.5 rounded-full", danger ? "bg-destructive" : "bg-primary")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("flex items-center gap-2 text-sm font-medium", danger && selected && "text-destructive-foreground")}>
          <Icon className="size-4 opacity-70" />
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </RadioGroup.Item>
  );
}

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Kbd } from "./ui/misc";

const SHORTCUTS: Array<[string[], string]> = [
  [["⌘", "1"], "Da archiviare"],
  [["⌘", "2"], "Archivio"],
  [["⌘", "3"], "Impostazioni"],
  [["⌘", "K"], "Cerca nell'archivio"],
  [["⌘", "R"], "Aggiorna la pagina corrente"],
  [["⌘", "B"], "Mostra o nascondi la barra laterale"],
  [["⌘", "/"], "Scorciatoie da tastiera"],
  [["Esc"], "Chiudi finestra o pannello"],
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Scorciatoie da tastiera</DialogTitle>
          <DialogDescription className="sr-only">Elenco delle scorciatoie disponibili</DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-5">
          <dl className="divide-y">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label} className="flex items-center justify-between py-2.5">
                <dt className="text-sm">{label}</dt>
                <dd className="flex gap-1">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

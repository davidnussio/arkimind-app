import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { X, Save, Tag, Building2, FileType, Calendar, FolderTree, FileText } from "lucide-react";

const CATEGORIES = [
  "Assicurazione", "Banca", "Fatture", "Imposte", "Salute",
  "Lavoro", "Abitazione", "Veicolo", "Amministrativo", "Educazione", "Altro",
];

interface ClassificationEditorProps {
  classification: any;
  onSave: (updated: any) => void;
  onCancel: () => void;
}

export function ClassificationEditor({ classification, onSave, onCancel }: ClassificationEditorProps) {
  const profile = classification.document_profile ?? {};
  const filing = classification.filing_strategy ?? {};

  const [category, setCategory] = useState(profile.category ?? "Altro");
  const [entity, setEntity] = useState(profile.entity ?? "");
  const [documentType, setDocumentType] = useState(profile.document_type ?? "");
  const [documentDate, setDocumentDate] = useState(profile.document_date ?? "");
  const [suggestedPath, setSuggestedPath] = useState(filing.full_suggested_path ?? "");
  const [suggestedFilename, setSuggestedFilename] = useState(filing.suggested_filename ?? "");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const handleSave = () => {
    const updated = {
      ...classification,
      document_profile: {
        ...classification.document_profile,
        category,
        entity,
        document_type: documentType,
        document_date: documentDate,
      },
      filing_strategy: {
        ...classification.filing_strategy,
        full_suggested_path: suggestedPath,
        suggested_filename: suggestedFilename,
      },
    };
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="mx-4 w-full max-w-lg rounded-xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">Modifica Classificazione</h3>
          <Button variant="ghost" size="icon-xs" onClick={onCancel}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="size-3" /> Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="size-3" /> Ente
            </label>
            <input type="text" value={entity} onChange={(e) => setEntity(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <FileType className="size-3" /> Tipo documento
            </label>
            <input type="text" value={documentType} onChange={(e) => setDocumentType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="size-3" /> Data documento
            </label>
            <input type="text" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)}
              placeholder="es. 2024-01-15"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
          </div>
          <hr className="border-border" />
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <FolderTree className="size-3" /> Percorso archiviazione
            </label>
            <input type="text" value={suggestedPath} onChange={(e) => setSuggestedPath(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="size-3" /> Nome file suggerito
            </label>
            <input type="text" value={suggestedFilename} onChange={(e) => setSuggestedFilename(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>Annulla</Button>
          <Button size="sm" className="flex-1" onClick={handleSave}>
            <Save className="size-3.5" /> Salva modifiche
          </Button>
        </div>
      </div>
    </div>
  );
}

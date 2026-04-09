import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { X, Save, Tag, Building2, FileType, Calendar, FolderTree, FileText, Repeat } from "lucide-react";

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
  const ricorrenza = classification.ricorrenza && typeof classification.ricorrenza === "object" ? classification.ricorrenza : null;

  const [category, setCategory] = useState(profile.category ?? "Altro");
  const [entity, setEntity] = useState(profile.entity ?? "");
  const [documentType, setDocumentType] = useState(profile.document_type ?? "");
  const [documentDate, setDocumentDate] = useState(profile.document_date ?? "");
  const [suggestedPath, setSuggestedPath] = useState(filing.full_suggested_path ?? "");
  const [suggestedFilename, setSuggestedFilename] = useState(filing.suggested_filename ?? "");
  const [isRecurring, setIsRecurring] = useState(ricorrenza?.is_recurring ?? false);
  const [frequency, setFrequency] = useState(ricorrenza?.frequency ?? "");
  const [recurrenceType, setRecurrenceType] = useState(ricorrenza?.recurrence_type ?? "unknown");

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
      ricorrenza: isRecurring || ricorrenza ? {
        ...(ricorrenza ?? {}),
        is_recurring: isRecurring,
        frequency: isRecurring ? (frequency || null) : null,
        recurrence_type: recurrenceType,
      } : classification.ricorrenza,
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
          {/* Ricorrenza section */}
          {(ricorrenza || classification.extracted_data?.financial) && (
            <>
              <hr className="border-border" />
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Repeat className="size-3" /> Pagamento ricorrente
                </label>
                <select
                  value={isRecurring ? "yes" : "no"}
                  onChange={(e) => setIsRecurring(e.target.value === "yes")}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  <option value="no">No</option>
                  <option value="yes">Sì</option>
                </select>
              </div>
              {isRecurring && (
                <>
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                      Frequenza
                    </label>
                    <select
                      value={frequency ?? ""}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Sconosciuta</option>
                      <option value="weekly">Settimanale</option>
                      <option value="monthly">Mensile</option>
                      <option value="quarterly">Trimestrale</option>
                      <option value="annual">Annuale</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                      Tipo ricorrenza
                    </label>
                    <select
                      value={recurrenceType}
                      onChange={(e) => setRecurrenceType(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                    >
                      <option value="subscription">Abbonamento</option>
                      <option value="utility">Utenza</option>
                      <option value="rent">Affitto</option>
                      <option value="installment">Rata</option>
                      <option value="maintenance">Manutenzione</option>
                      <option value="one_time">Una tantum</option>
                      <option value="unknown">Sconosciuto</option>
                    </select>
                  </div>
                </>
              )}
            </>
          )}
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

import { useEffect } from "react";
import { Button } from "./ui/button";
import {
  Archive,
  Loader2,
  X,
  Tag,
  Building2,
  FileType,
  Calendar,
  Receipt,
  FolderTree,
  FileText,
  Brain,
  Banknote,
  Pencil,
  Repeat,
} from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";

interface ClassificationResultProps {
  classification: any;
  fileName: string;
  onArchive: () => void;
  onEdit?: () => void;
  onClose: () => void;
  archiving: boolean;
}

export function ClassificationResult({
  classification,
  fileName,
  onArchive,
  onEdit,
  onClose,
  archiving,
}: ClassificationResultProps) {
  const profile = classification.document_profile;
  const filing = classification.filing_strategy;
  const financial = classification.extracted_data?.financial;
  const analysis = classification.ai_analysis;
  const ricorrenza = classification.ricorrenza;

  const categoryColor =
    CATEGORY_COLORS[profile?.category] ?? CATEGORY_COLORS.Altro;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium">Risultato Classificazione</h3>
            <p className="truncate text-xs text-muted-foreground">{fileName}</p>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {/* Document Profile */}
          <section>
            <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Profilo Documento
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Categoria:</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor}`}>
                  {profile?.category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ente:</span>
                <span className="text-sm">{profile?.entity}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileType className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tipo:</span>
                <span className="text-sm">{profile?.document_type}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Data:</span>
                <span className="text-sm">{profile?.document_date}</span>
              </div>
              {profile?.is_tax_relevant && (
                <div className="flex items-center gap-2">
                  <Receipt className="size-3.5 text-muted-foreground" />
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Imposte
                  </span>
                  {profile.tax_notes && (
                    <span className="text-xs text-muted-foreground">{profile.tax_notes}</span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Filing Strategy */}
          <section>
            <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Strategia di Archiviazione
            </h4>
            <div className="space-y-2 rounded-md bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                <FolderTree className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <span className="text-xs text-muted-foreground">Percorso:</span>
                  <p className="font-mono text-sm">{filing?.full_suggested_path}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <span className="text-xs text-muted-foreground">Nome file:</span>
                  <p className="font-mono text-sm">{filing?.suggested_filename}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Financial Data */}
          {financial && financial !== false && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Dati Finanziari
              </h4>
              <div className="space-y-1.5">
                {financial.amount != null && (
                  <div className="flex items-center gap-2">
                    <Banknote className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {financial.currency} {financial.amount?.toFixed(2)}
                    </span>
                    {financial.is_paid != null && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        financial.is_paid
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {financial.is_paid ? "Pagato" : "Non pagato"}
                      </span>
                    )}
                  </div>
                )}
                {financial.is_invoice && (
                  <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    Fattura
                  </span>
                )}
              </div>
            </section>
          )}

          {/* AI Analysis */}
          {analysis && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Analisi AI
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Brain className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Confidenza:</span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          analysis.confidence_score > 0.8 ? "bg-green-500"
                            : analysis.confidence_score > 0.5 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${(analysis.confidence_score * 100).toFixed(0)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium">
                    {(analysis.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
                {analysis.needs_human_validation && (
                  <p className="rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                    Richiede validazione umana
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{analysis.reasoning}</p>
              </div>
            </section>
          )}

          {/* Ricorrenza */}
          {ricorrenza && ricorrenza !== false && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Ricorrenza
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Repeat className="size-3.5 text-muted-foreground" />
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ricorrenza.is_recurring
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                  }`}>
                    {ricorrenza.is_recurring ? "Ricorrente" : "Non ricorrente"}
                  </span>
                  {ricorrenza.confidence && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      ricorrenza.confidence === "high"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : ricorrenza.confidence === "medium"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {ricorrenza.confidence}
                    </span>
                  )}
                </div>
                {ricorrenza.is_recurring && ricorrenza.frequency && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Frequenza:</span>
                    <span className="font-medium capitalize">{ricorrenza.frequency}</span>
                  </div>
                )}
                {ricorrenza.recurrence_type && ricorrenza.recurrence_type !== "unknown" && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium capitalize">{ricorrenza.recurrence_type}</span>
                  </div>
                )}
                {ricorrenza.signals && ricorrenza.signals.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ricorrenza.signals.map((s, i) => (
                      <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {ricorrenza.reasoning && (
                  <p className="text-xs text-muted-foreground">{ricorrenza.reasoning}</p>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Chiudi
          </Button>
          {onEdit && (
            <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
              <Pencil className="size-3.5" />
              Modifica
            </Button>
          )}
          <Button size="sm" className="flex-1" onClick={onArchive} disabled={archiving}>
            {archiving ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
            Archivia
          </Button>
        </div>
      </div>
    </div>
  );
}

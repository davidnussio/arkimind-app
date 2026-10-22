import { useState, type ReactNode } from "react";
import { Input, Label, Select } from "./ui/input";
import { Section } from "./ClassificationDetails";
import type { ClassificationResult, RecurrenceData } from "../../shared/types";
import { CATEGORIES, recurrenceOf } from "@/lib/documents";
import { FREQUENCY_LABELS, RECURRENCE_TYPE_LABELS, formatDate } from "@/lib/format";

type Frequency = NonNullable<RecurrenceData["frequency"]>;
type RecurrenceType = RecurrenceData["recurrence_type"];

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id?: string;
  label: string;
  hint?: ReactNode;
  error?: string | false;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive-foreground">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Checkbox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-default items-center gap-2.5 text-sm font-medium">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-input accent-primary"
      />
      {label}
    </label>
  );
}

/**
 * Edits what the AI understood about a document. Submitting returns a copy of
 * the classification marked `user_verified`; saving it is up to the caller.
 */
export function ClassificationForm({
  id,
  classification,
  onSubmit,
}: {
  id: string;
  classification: ClassificationResult;
  onSubmit: (updated: ClassificationResult) => void;
}) {
  const profile = classification.document_profile;
  const filing = classification.filing_strategy;
  const recurrence = recurrenceOf(classification);

  const [category, setCategory] = useState(profile?.category || "Altro");
  const [entity, setEntity] = useState(profile?.entity ?? "");
  const [documentType, setDocumentType] = useState(profile?.document_type ?? "");
  const [documentDate, setDocumentDate] = useState(profile?.document_date ?? "");
  const [taxRelevant, setTaxRelevant] = useState(Boolean(profile?.is_tax_relevant));
  const [taxNotes, setTaxNotes] = useState(profile?.tax_notes ?? "");
  const [recurring, setRecurring] = useState(Boolean(recurrence?.is_recurring));
  const [frequency, setFrequency] = useState<Frequency>(recurrence?.frequency ?? "monthly");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(recurrence?.recurrence_type ?? "unknown");
  const [path, setPath] = useState(filing?.full_suggested_path ?? "");
  const [filename, setFilename] = useState(filing?.suggested_filename ?? "");
  const [touched, setTouched] = useState(false);

  const categories = CATEGORIES.includes(category) ? CATEGORIES : [category, ...CATEGORIES];
  const formattedDate = formatDate(documentDate.trim());
  const pathError = touched && !path.trim() && "Indica la cartella di destinazione.";
  const filenameError = touched && !filename.trim() && "Indica il nome del file.";

  const submit = () => {
    setTouched(true);
    if (!path.trim() || !filename.trim()) return;
    const ricorrenza: ClassificationResult["ricorrenza"] = recurring
      ? {
          confidence: "high",
          signals: [],
          reasoning: "",
          ...recurrence,
          is_recurring: true,
          frequency,
          recurrence_type: recurrenceType,
        }
      : recurrence
        ? { ...recurrence, is_recurring: false }
        : false;
    onSubmit({
      ...classification,
      document_profile: {
        ...profile,
        category,
        entity: entity.trim(),
        document_type: documentType.trim(),
        document_date: documentDate.trim(),
        is_tax_relevant: taxRelevant,
        tax_notes: taxRelevant ? taxNotes.trim() || undefined : undefined,
      },
      filing_strategy: {
        ...filing,
        full_suggested_path: path
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean)
          .join("/"),
        suggested_filename: filename.trim(),
      },
      ricorrenza,
      user_verified: true,
    });
  };

  return (
    <form
      id={id}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <Section title="Destinazione">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Field
            id="cf-path"
            label="Cartella"
            hint="Separa le sottocartelle con «/». Quelle mancanti vengono create nell'archivio."
            error={pathError}
          >
            <Input id="cf-path" value={path} onChange={(e) => setPath(e.target.value)} aria-invalid={Boolean(pathError)} />
          </Field>
          <Field
            id="cf-name"
            label="Nome file"
            hint="L'estensione originale viene mantenuta."
            error={filenameError}
          >
            <Input
              id="cf-name"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              aria-invalid={Boolean(filenameError)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Documento">
        <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4">
          <Field id="cf-category" label="Categoria">
            <Select id="cf-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="cf-date"
            label="Data"
            hint={formattedDate && formattedDate !== documentDate.trim() ? formattedDate : "AAAA-MM-GG"}
          >
            <Input
              id="cf-date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              placeholder="2026-09-30"
              inputMode="numeric"
            />
          </Field>
          <Field id="cf-entity" label="Ente o mittente">
            <Input id="cf-entity" value={entity} onChange={(e) => setEntity(e.target.value)} />
          </Field>
          <Field id="cf-type" label="Tipo">
            <Input id="cf-type" value={documentType} onChange={(e) => setDocumentType(e.target.value)} />
          </Field>

          <div className="col-span-2 space-y-3 border-t pt-4">
            <Checkbox id="cf-tax" checked={taxRelevant} onChange={setTaxRelevant} label="Rilevante ai fini fiscali" />
            {taxRelevant && (
              <Input
                aria-label="Note fiscali"
                value={taxNotes}
                onChange={(e) => setTaxNotes(e.target.value)}
                placeholder="Note fiscali (facoltative), es. detraibile al 19%"
              />
            )}
          </div>

          <div className="col-span-2 space-y-3 border-t pt-4">
            <Checkbox id="cf-recurring" checked={recurring} onChange={setRecurring} label="Spesa ricorrente" />
            {recurring && (
              <div className="grid grid-cols-2 gap-4">
                <Field id="cf-frequency" label="Frequenza">
                  <Select
                    id="cf-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as Frequency)}
                  >
                    {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                      <option key={f} value={f}>
                        {FREQUENCY_LABELS[f]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="cf-recurrence-type" label="Tipo di spesa">
                  <Select
                    id="cf-recurrence-type"
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  >
                    {(Object.keys(RECURRENCE_TYPE_LABELS) as RecurrenceType[]).map((t) => (
                      <option key={t} value={t}>
                        {RECURRENCE_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </div>
        </div>
      </Section>
    </form>
  );
}

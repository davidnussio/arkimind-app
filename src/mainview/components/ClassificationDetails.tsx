import type { ReactNode } from "react";
import { Repeat } from "lucide-react";
import { Badge } from "./ui/badge";
import { CategoryBadge } from "./badges";
import type { ClassificationResult } from "../../shared/types";
import { confidenceOf, financialOf, recurrenceOf, REVIEW_THRESHOLD } from "@/lib/documents";
import {
  CONFIDENCE_LABELS,
  FREQUENCY_LABELS,
  RECURRENCE_TYPE_LABELS,
  formatDate,
  formatMoney,
  formatPercent,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children}</dd>
    </div>
  );
}

export function ConfidenceMeter({ score }: { score: number }) {
  const tone = score >= 0.8 ? "bg-success" : score >= REVIEW_THRESHOLD ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Confidenza dell'analisi"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(score * 100)}
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: formatPercent(score) }} />
      </div>
      <span className="w-10 text-right text-sm font-semibold tabular-nums">{formatPercent(score)}</span>
    </div>
  );
}

/** Profile, money, recurrence and AI reasoning of a classification. */
export function ClassificationDetails({ classification }: { classification: ClassificationResult }) {
  const profile = classification.document_profile;
  const financial = financialOf(classification);
  const recurrence = recurrenceOf(classification);
  const score = confidenceOf(classification);

  return (
    <>
      <Section title="Documento">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-4">
          <Field label="Categoria">
            {profile?.category ? <CategoryBadge category={profile.category} /> : "—"}
          </Field>
          <Field label="Data">{formatDate(profile?.document_date) || "—"}</Field>
          <Field label="Ente o mittente">{profile?.entity || "—"}</Field>
          <Field label="Tipo">{profile?.document_type || "—"}</Field>
          {financial?.amount != null && (
            <Field label="Importo">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold tabular-nums">{formatMoney(financial.amount, financial.currency)}</span>
                {financial.is_paid != null && (
                  <Badge tone={financial.is_paid ? "success" : "warning"}>
                    {financial.is_paid ? "Pagato" : "Da pagare"}
                  </Badge>
                )}
              </span>
            </Field>
          )}
          {financial?.is_invoice != null && <Field label="Fattura">{financial.is_invoice ? "Sì" : "No"}</Field>}
          {profile?.is_tax_relevant && (
            <Field label="Rilevanza fiscale" wide>
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone="danger">Fiscale</Badge>
                {profile.tax_notes && <span className="text-muted-foreground">{profile.tax_notes}</span>}
              </span>
            </Field>
          )}
          {recurrence?.is_recurring && (
            <Field label="Ricorrenza" wide>
              <span className="flex items-center gap-1.5">
                <Repeat className="size-3.5 text-muted-foreground" />
                {[
                  recurrence.frequency ? FREQUENCY_LABELS[recurrence.frequency] : null,
                  recurrence.recurrence_type !== "unknown" ? RECURRENCE_TYPE_LABELS[recurrence.recurrence_type] : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sì"}
              </span>
            </Field>
          )}
        </dl>
      </Section>

      {(score != null || classification.ai_analysis?.reasoning) && (
        <Section title="Analisi AI">
          <div className="space-y-3 rounded-xl border bg-card p-4">
            {score != null && (
              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">Confidenza</div>
                <ConfidenceMeter score={score} />
              </div>
            )}
            {classification.ai_analysis?.reasoning && (
              <p className="text-sm leading-relaxed text-muted-foreground">{classification.ai_analysis.reasoning}</p>
            )}
            {recurrence?.is_recurring && (recurrence.reasoning || recurrence.signals?.length > 0) && (
              <div className="border-t pt-3">
                <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  Perché è ricorrente
                  {recurrence.confidence && <span>· {CONFIDENCE_LABELS[recurrence.confidence]}</span>}
                </div>
                {recurrence.reasoning && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{recurrence.reasoning}</p>
                )}
                {recurrence.signals?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {recurrence.signals.map((signal, i) => (
                      <Badge key={i} tone="neutral" className="font-normal">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}
    </>
  );
}

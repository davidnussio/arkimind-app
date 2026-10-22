import { AlertTriangle, Archive, CircleDashed, Sparkles, File, FileImage, FileSpreadsheet, FileText } from "lucide-react";
import { Badge } from "./ui/badge";
import { categoryDot, fileKind, stageOf, type Stage } from "@/lib/documents";
import { cn } from "@/lib/utils";

const STAGES: Record<Stage, { label: string; tone: "neutral" | "info" | "success"; icon: typeof Archive }> = {
  new: { label: "Da analizzare", tone: "neutral", icon: CircleDashed },
  analyzed: { label: "Analizzato", tone: "info", icon: Sparkles },
  archived: { label: "Archiviato", tone: "success", icon: Archive },
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const stage = STAGES[stageOf(status)];
  const Icon = stage.icon;
  return (
    <Badge tone={stage.tone} className={className}>
      <Icon />
      {stage.label}
    </Badge>
  );
}

export function ReviewBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warning" className={className}>
      <AlertTriangle />
      Da verificare
    </Badge>
  );
}

export function CategoryBadge({ category, className }: { category?: string | null; className?: string }) {
  if (!category) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", categoryDot(category))} />
      <span className="truncate">{category}</span>
    </span>
  );
}

const KIND_STYLES = {
  pdf: { icon: FileText, className: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" },
  image: { icon: FileImage, className: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
  doc: { icon: FileText, className: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" },
  sheet: { icon: FileSpreadsheet, className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  other: { icon: File, className: "bg-muted text-muted-foreground" },
};

export function FileIcon({
  mimeType,
  name,
  size = "md",
}: {
  mimeType?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
}) {
  const kind = KIND_STYLES[fileKind(mimeType, name)];
  const Icon = kind.icon;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "sm" && "size-7 rounded-md",
        size === "md" && "size-9 rounded-lg",
        size === "lg" && "size-11 rounded-xl",
        kind.className,
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-4"} strokeWidth={1.75} />
    </span>
  );
}

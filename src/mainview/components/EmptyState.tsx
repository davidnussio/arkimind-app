import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "success" | "danger";
  size?: "sm" | "md";
  className?: string;
}

const TONES = {
  neutral: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  danger: "bg-destructive-soft text-destructive",
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "md" ? "px-6 py-16" : "px-4 py-8",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl",
          size === "md" ? "mb-5 size-14" : "mb-3 size-10 rounded-xl",
          TONES[tone],
        )}
      >
        <Icon className={size === "md" ? "size-7" : "size-5"} strokeWidth={1.75} />
      </div>
      <h3 className={cn("font-semibold tracking-tight", size === "md" ? "text-base" : "text-sm")}>{title}</h3>
      {description && (
        <p className={cn("mt-1.5 max-w-sm text-muted-foreground", size === "md" ? "text-sm" : "text-[0.8125rem]")}>
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

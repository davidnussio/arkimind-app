import * as React from "react"
import { ToggleGroup } from "radix-ui"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1.5 font-sans text-[0.6875rem] font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Single-choice segmented control (Radix ToggleGroup, arrow-key navigable). */
function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T
  onValueChange: (value: T) => void
  options: Array<{ value: T; label: React.ReactNode; icon?: LucideIcon }>
  className?: string
  "aria-label": string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5", className)}
    >
      {options.map(({ value: v, label, icon: Icon }) => (
        <ToggleGroup.Item
          key={v}
          value={v}
          className="inline-flex h-7 cursor-default items-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:bg-input/40 [&_svg]:size-3.5"
        >
          {Icon && <Icon />}
          {label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

/** Inline message block for warnings, errors and hints. */
function Callout({
  tone = "info",
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success" | "neutral"
  icon?: React.ComponentType<{ className?: string }>
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  const tones = {
    info: "bg-info-soft text-info-foreground",
    warning: "bg-warning-soft text-warning-foreground",
    danger: "bg-destructive-soft text-destructive-foreground",
    success: "bg-success-soft text-success-foreground",
    neutral: "bg-muted text-muted-foreground",
  }
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn("flex items-start gap-3 rounded-lg px-3.5 py-3 text-sm", tones[tone], className)}
    >
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

export { Callout, Kbd, Segmented, Skeleton }

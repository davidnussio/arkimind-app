import { useId } from "react";
import { cn } from "@/lib/utils";

/** The Arkimind mark (same artwork as the favicon in index.html). */
export function Logo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <path d="M8 22V12l8-5 8 5v10l-8 5z" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 12l8 5 8-5M16 17v10" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

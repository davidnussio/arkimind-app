import type { ReactNode } from "react";

interface EmptyStateProps {
  illustration: "folder" | "document" | "search";
  title: string;
  description?: string;
  action?: ReactNode;
}

function FolderIllustration() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/20">
      <rect x="10" y="30" width="100" height="60" rx="8" fill="currentColor" />
      <path d="M10 38C10 33.5817 13.5817 30 18 30H42L50 20H102C106.418 20 110 23.5817 110 28V30H10V38Z" fill="currentColor" opacity="0.7" />
      <circle cx="60" cy="60" r="12" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
      <path d="M56 60L59 63L65 57" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

function DocumentIllustration() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/20">
      <rect x="25" y="5" width="70" height="90" rx="6" fill="currentColor" />
      <path d="M25 11C25 7.68629 27.6863 5 31 5H70L95 30V89C95 92.3137 92.3137 95 89 95H31C27.6863 95 25 92.3137 25 89V11Z" fill="currentColor" />
      <path d="M70 5V24C70 27.3137 72.6863 30 76 30H95L70 5Z" fill="currentColor" opacity="0.6" />
      <rect x="38" y="42" width="44" height="4" rx="2" fill="currentColor" opacity="0.4" />
      <rect x="38" y="52" width="36" height="4" rx="2" fill="currentColor" opacity="0.4" />
      <rect x="38" y="62" width="40" height="4" rx="2" fill="currentColor" opacity="0.4" />
      <rect x="38" y="72" width="24" height="4" rx="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/20">
      <circle cx="52" cy="45" r="28" stroke="currentColor" strokeWidth="6" />
      <line x1="72" y1="65" x2="100" y2="93" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M40 38C42 30 48 25 56 25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

const illustrations = {
  folder: FolderIllustration,
  document: DocumentIllustration,
  search: SearchIllustration,
};

export function EmptyState({ illustration, title, description, action }: EmptyStateProps) {
  const Illustration = illustrations[illustration];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Illustration />
      <h3 className="mt-4 text-base font-medium text-foreground/80">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

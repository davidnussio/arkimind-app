import type { ReactNode } from "react";
import {
  Archive,
  Cloud,
  CloudOff,
  Inbox,
  Keyboard,
  Loader2,
  LogIn,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { IconButton } from "./ui/icon-button";
import { Tooltip } from "./ui/tooltip";
import { cn } from "@/lib/utils";

export type Page = "inbox" | "archive" | "settings";

const NAV: Array<{ id: Page; label: string; icon: LucideIcon; shortcut: string }> = [
  { id: "inbox", label: "Da archiviare", icon: Inbox, shortcut: "⌘1" },
  { id: "archive", label: "Archivio", icon: Archive, shortcut: "⌘2" },
  { id: "settings", label: "Impostazioni", icon: Settings, shortcut: "⌘3" },
];

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  inboxCount: number;
  authenticated: boolean | null;
  signingIn: boolean;
  onSignIn: () => void;
  dark: boolean;
  onToggleTheme: () => void;
  onShowShortcuts: () => void;
  version: string;
}

export function Sidebar({
  page,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  inboxCount,
  authenticated,
  signingIn,
  onSignIn,
  dark,
  onToggleTheme,
  onShowShortcuts,
  version,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-60",
      )}
    >
      <div className={cn("flex h-16 items-center gap-2.5", collapsed ? "justify-center" : "px-5")}>
        <Logo className="size-7" />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="text-[0.9375rem] font-semibold tracking-tight text-foreground">Arkimind</div>
            <div className="text-[0.6875rem] text-muted-foreground">Archivio intelligente</div>
          </div>
        )}
      </div>

      <nav aria-label="Sezioni" className={cn("space-y-0.5 pt-2", collapsed ? "px-2" : "px-3")}>
        {NAV.map((item) => {
          const active = page === item.id;
          const Icon = item.icon;
          const count = item.id === "inbox" ? inboxCount : 0;
          const button = (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                "relative flex h-9 w-full items-center gap-3 rounded-lg text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/40",
                collapsed ? "justify-center" : "px-3",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-[18px] shrink-0", active ? "text-sidebar-primary" : "opacity-70")} />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {count > 0 &&
                (collapsed ? (
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sidebar-primary ring-2 ring-sidebar" />
                ) : (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 py-px text-center text-[0.6875rem] font-semibold tabular-nums",
                      active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-sidebar-border text-sidebar-foreground",
                    )}
                    aria-label={`${count} file`}
                  >
                    {count}
                  </span>
                ))}
            </button>
          );
          return collapsed ? (
            <Tooltip key={item.id} label={item.label} shortcut={item.shortcut} side="right">
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className={cn("space-y-2 pb-3", collapsed ? "px-2" : "px-3")}>
        <DriveStatus
          authenticated={authenticated}
          signingIn={signingIn}
          onSignIn={onSignIn}
          onOpenSettings={() => onNavigate("settings")}
          collapsed={collapsed}
        />
        <div
          className={cn(
            "flex items-center border-t border-sidebar-border pt-2",
            collapsed ? "flex-col gap-1" : "gap-0.5",
          )}
        >
          <IconButton
            label={dark ? "Tema chiaro" : "Tema scuro"}
            icon={dark ? Sun : Moon}
            onClick={onToggleTheme}
          />
          <IconButton label="Scorciatoie da tastiera" shortcut="⌘/" icon={Keyboard} onClick={onShowShortcuts} />
          <IconButton
            label={collapsed ? "Espandi barra laterale" : "Comprimi barra laterale"}
            shortcut="⌘B"
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            onClick={onToggleCollapsed}
          />
          {!collapsed && (
            <span className="ml-auto pr-1 text-[0.6875rem] text-muted-foreground tabular-nums">v{version}</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function DriveStatus({
  authenticated,
  signingIn,
  onSignIn,
  onOpenSettings,
  collapsed,
}: {
  authenticated: boolean | null;
  signingIn: boolean;
  onSignIn: () => void;
  onOpenSettings: () => void;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <Tooltip
        side="right"
        label={authenticated ? "Google Drive collegato" : authenticated === false ? "Accedi a Google Drive" : "Verifica…"}
      >
        <button
          onClick={authenticated ? onOpenSettings : onSignIn}
          aria-label={authenticated ? "Google Drive collegato" : "Accedi a Google Drive"}
          className="relative mx-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent/50"
        >
          {authenticated === false ? <CloudOff className="size-[18px]" /> : <Cloud className="size-[18px]" />}
          <span
            className={cn(
              "absolute right-1.5 bottom-1.5 size-2 rounded-full ring-2 ring-sidebar",
              authenticated ? "bg-success" : authenticated === false ? "bg-warning" : "bg-muted-foreground/40",
            )}
          />
        </button>
      </Tooltip>
    );
  }

  if (authenticated === false) {
    return (
      <div className="rounded-xl border border-sidebar-border bg-card p-3">
        <div className="flex items-center gap-2 text-[0.8125rem] font-medium">
          <CloudOff className="size-4 text-warning" />
          Drive non collegato
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Accedi per vedere e archiviare i file.</p>
        <Button size="sm" className="mt-2.5 w-full" onClick={onSignIn} disabled={signingIn}>
          {signingIn ? <Loader2 className="animate-spin" /> : <LogIn />}
          Accedi con Google
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={onOpenSettings}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-sidebar-accent/50"
    >
      <span className="relative">
        <Cloud className="size-4" />
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-sidebar",
            authenticated ? "bg-success" : "bg-muted-foreground/40",
          )}
        />
      </span>
      <span className="flex-1">
        <span className="block font-medium text-foreground">Google Drive</span>
        {authenticated ? "Collegato" : "Verifica in corso…"}
      </span>
    </button>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SignInPrompt({
  signingIn,
  onSignIn,
  description,
}: {
  signingIn: boolean;
  onSignIn: () => void;
  description: string;
}) {
  return (
    <div className="rounded-2xl border bg-card px-6 py-14 text-center shadow-xs">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Cloud className="size-7" strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-semibold tracking-tight">Collega Google Drive</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button size="lg" className="mt-6" onClick={onSignIn} disabled={signingIn}>
        {signingIn ? <Loader2 className="animate-spin" /> : <LogIn />}
        {signingIn ? "In attesa del browser…" : "Accedi con Google"}
      </Button>
      {signingIn && (
        <p className="mt-3 text-xs text-muted-foreground">Completa l'accesso nella finestra del browser che si è aperta.</p>
      )}
    </div>
  );
}

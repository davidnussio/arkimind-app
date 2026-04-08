import { useState, useEffect, useCallback } from "react";
import { Dashboard } from "./components/Dashboard";
import { Documents } from "./components/Documents";
import { Settings } from "./components/Settings";
import { OnboardingWizard } from "./components/OnboardingWizard";
import {
  LayoutDashboard,
  FileText,
  Settings as SettingsIcon,
  Archive,
  AlertCircle,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  Clock,
  Keyboard,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

type Tab = "dashboard" | "documents" | "settings";

const APP_VERSION = __APP_VERSION__;

const NAV_ITEMS: Array<{
  id: Tab;
  label: string;
  icon: typeof LayoutDashboard;
  shortcut: string;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "⌘1" },
  { id: "documents", label: "Documenti", icon: FileText, shortcut: "⌘2" },
  { id: "settings", label: "Impostazioni", icon: SettingsIcon, shortcut: "⌘3" },
];

function getInitialDarkMode(): boolean {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("arkimind-dark-mode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("arkimind-dark-mode", String(darkMode));
  }, [darkMode]);

  // Check onboarding
  useEffect(() => {
    api.getSettings().then((s) => {
      // Check if onboarding was completed by looking for a setting
      // We use a simple heuristic: if no API key and no archive root, show onboarding
      const hasConfig = s.apiKey || s.archiveRootFolderId;
      const onboardingDone = localStorage.getItem("arkimind-onboarding-done");
      setShowOnboarding(!hasConfig && !onboardingDone);
    }).catch(() => {
      setShowOnboarding(false);
    });
  }, []);

  // Auth check
  useEffect(() => {
    api
      .getAuthStatus()
      .then((r) => setAuthenticated(r.authenticated))
      .catch(() => setAuthenticated(false));
  }, [activeTab]);

  // Track last sync time
  const updateSyncTime = useCallback(() => {
    setLastSync(new Date());
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘1/2/3 for tab switching
      if (e.metaKey && !e.shiftKey && !e.altKey) {
        if (e.key === "1") { e.preventDefault(); setActiveTab("dashboard"); }
        if (e.key === "2") { e.preventDefault(); setActiveTab("documents"); }
        if (e.key === "3") { e.preventDefault(); setActiveTab("settings"); }
      }
      // ⌘R for refresh
      if (e.metaKey && e.key === "r") {
        e.preventDefault();
        updateSyncTime();
      }
      // ⌘K for search (switch to documents and focus search)
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setActiveTab("documents");
      }
      // ⌘B for sidebar toggle
      if (e.metaKey && e.key === "b") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
      // ⌘/ for shortcuts help
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      // Escape to close shortcuts
      if (e.key === "Escape" && showShortcuts) {
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [updateSyncTime, showShortcuts]);

  const formatLastSync = () => {
    if (!lastSync) return null;
    return lastSync.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  if (showOnboarding === null) return null; // Loading

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={() => {
          localStorage.setItem("arkimind-onboarding-done", "true");
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ${
          sidebarCollapsed ? "w-14" : "w-52"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4">
          <Archive className="size-5 shrink-0 text-sidebar-primary" />
          {!sidebarCollapsed && (
            <span className="flex items-baseline gap-1.5 text-sm font-semibold text-sidebar-foreground">
              <span>Arkimind</span>
              <span className="text-[10px] font-normal text-sidebar-foreground/40">
                v{APP_VERSION}
              </span>
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={sidebarCollapsed ? `${item.label} (${item.shortcut})` : undefined}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className="text-[10px] text-sidebar-foreground/30">{item.shortcut}</span>
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="space-y-1 border-t border-sidebar-border px-2 py-2">
          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? "Modalità chiara" : "Modalità scura"}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            {darkMode ? <Sun className="size-3.5 shrink-0" /> : <Moon className="size-3.5 shrink-0" />}
            {!sidebarCollapsed && (darkMode ? "Tema chiaro" : "Tema scuro")}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={sidebarCollapsed ? "Espandi sidebar (⌘B)" : "Comprimi sidebar (⌘B)"}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            {sidebarCollapsed ? <PanelLeft className="size-3.5 shrink-0" /> : <PanelLeftClose className="size-3.5 shrink-0" />}
            {!sidebarCollapsed && "Comprimi"}
          </button>

          {/* Shortcuts help */}
          <button
            onClick={() => setShowShortcuts(true)}
            title="Scorciatoie da tastiera (⌘/)"
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            <Keyboard className="size-3.5 shrink-0" />
            {!sidebarCollapsed && "Scorciatoie"}
          </button>

          {/* Auth status */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-sidebar-foreground/60">
            <span
              className={`size-2 shrink-0 rounded-full ${
                authenticated === true
                  ? "bg-green-500"
                  : authenticated === false
                    ? "bg-yellow-500"
                    : "bg-gray-400"
              }`}
            />
            {!sidebarCollapsed && (
              authenticated === true
                ? "Drive connesso"
                : authenticated === false
                  ? "Non autenticato"
                  : "Verifica..."
            )}
          </div>

          {/* Last sync indicator */}
          {lastSync && !sidebarCollapsed && (
            <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-sidebar-foreground/40">
              <Clock className="size-3 shrink-0" />
              Ultimo aggiornamento: {formatLastSync()}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {authenticated === false && activeTab !== "settings" && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>
              Non sei autenticato con Google Drive.{" "}
              <button
                onClick={() => setActiveTab("settings")}
                className="font-medium underline"
              >
                Vai alle impostazioni
              </button>{" "}
              per accedere.
            </span>
          </div>
        )}

        {/* Tab content with transition */}
        <div className="animate-in fade-in duration-200">
          {activeTab === "dashboard" && <Dashboard onSync={updateSyncTime} />}
          {activeTab === "documents" && <Documents />}
          {activeTab === "settings" && <Settings />}
        </div>
      </main>

      {/* Keyboard shortcuts dialog */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowShortcuts(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-medium">Scorciatoie da tastiera</h3>
              <button onClick={() => setShowShortcuts(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-1 p-4">
              {[
                ["⌘1", "Dashboard"],
                ["⌘2", "Documenti"],
                ["⌘3", "Impostazioni"],
                ["⌘K", "Cerca documenti"],
                ["⌘R", "Aggiorna dati"],
                ["⌘B", "Comprimi/espandi sidebar"],
                ["⌘/", "Mostra scorciatoie"],
                ["Esc", "Chiudi finestre modali"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">{desc}</span>
                  <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

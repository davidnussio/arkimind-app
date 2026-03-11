import { useState, useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { Documents } from "./components/Documents";
import { Settings } from "./components/Settings";
import {
  LayoutDashboard,
  FileText,
  Settings as SettingsIcon,
  Archive,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";

type Tab = "dashboard" | "documents" | "settings";

const NAV_ITEMS: Array<{
  id: Tab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "documents", label: "Documenti", icon: FileText },
  { id: "settings", label: "Impostazioni", icon: SettingsIcon },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((r) => setAuthenticated(r.authenticated))
      .catch(() => setAuthenticated(false));
  }, [activeTab]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-52 flex-col border-r border-sidebar-border bg-sidebar">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4">
          <Archive className="size-5 text-sidebar-primary" />
          <span className="text-sm font-semibold text-sidebar-foreground">
            Arkimind v1.1
          </span>
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
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Auth status */}
        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
            <span
              className={`size-2 rounded-full ${
                authenticated === true
                  ? "bg-green-500"
                  : authenticated === false
                    ? "bg-yellow-500"
                    : "bg-gray-400"
              }`}
            />
            {authenticated === true
              ? "Google Drive connesso"
              : authenticated === false
                ? "Non autenticato"
                : "Verifica..."}
          </div>
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
                className="font-medium underline">
                Vai alle impostazioni
              </button>{" "}
              per accedere.
            </span>
          </div>
        )}

        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "documents" && <Documents />}
        {activeTab === "settings" && <Settings />}
      </main>
    </div>
  );
}

export default App;

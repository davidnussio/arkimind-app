import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar, type Page } from "./components/layout";
import { Logo } from "./components/Logo";
import { ActivityPanel } from "./components/ActivityPanel";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { usePreview } from "./components/PreviewDialog";
import { useToast } from "./components/Toaster";
import { InboxPage } from "./screens/InboxPage";
import { ArchivePage } from "./screens/ArchivePage";
import { SettingsPage } from "./screens/SettingsPage";
import { OnboardingPage } from "./screens/OnboardingPage";
import { useTheme } from "./hooks/use-theme";
import { useAuth } from "./hooks/use-auth";
import { useInbox } from "./hooks/use-inbox";
import { useActivity } from "./hooks/use-activity";
import { api } from "@/lib/api";
import { onShortcutAction } from "@/lib/rpc";

const APP_VERSION = __APP_VERSION__;
const ONBOARDING_KEY = "arkimind-onboarding-done";
const SIDEBAR_KEY = "arkimind-sidebar-collapsed";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

function App() {
  const { toast } = useToast();
  const theme = useTheme();
  const auth = useAuth();
  const inbox = useInbox(auth.authenticated === true);
  const activity = useActivity();
  const preview = usePreview();

  const [page, setPage] = useState<Page>("inbox");
  const [collapsed, setCollapsed] = useState(() => readFlag(SIDEBAR_KEY));
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [onboarding, setOnboarding] = useState<boolean | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [searchSignal, setSearchSignal] = useState(0);

  // First run: show onboarding when nothing is configured yet.
  useEffect(() => {
    api
      .getSettings()
      .then((s) => setOnboarding(!(s.apiKey || s.archiveRootFolderId) && !readFlag(ONBOARDING_KEY)))
      .catch(() => setOnboarding(false));
  }, []);

  useEffect(() => writeFlag(SIDEBAR_KEY, collapsed), [collapsed]);

  // Each page starts at the top.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const signIn = useCallback(async () => {
    const result = await auth.login();
    if (result.success) toast("Google Drive collegato", "success");
    else toast(result.error ?? "Accesso non riuscito", "error");
  }, [auth.login, toast]);

  // Native menu accelerators arrive over RPC (see src/bun/index.ts).
  const pageRef = useRef(page);
  pageRef.current = page;
  const reloadInbox = inbox.reload;
  useEffect(
    () =>
      onShortcutAction((action) => {
        switch (action) {
          case "nav-dashboard":
            setPage("inbox");
            break;
          case "nav-documents":
            setPage("archive");
            break;
          case "nav-settings":
            setPage("settings");
            break;
          case "search":
            setPage("archive");
            setSearchSignal((n) => n + 1);
            break;
          case "refresh":
            if (pageRef.current === "inbox") reloadInbox();
            else if (pageRef.current === "archive") setRefreshSignal((n) => n + 1);
            break;
          case "toggle-sidebar":
            setCollapsed((c) => !c);
            break;
          case "show-shortcuts":
            setShowShortcuts((s) => !s);
            break;
        }
      }),
    [reloadInbox],
  );

  // Files dropped outside a folder card must not navigate the webview away.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  if (onboarding === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="size-12" />
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Caricamento" />
      </div>
    );
  }

  if (onboarding) {
    return (
      <OnboardingPage
        auth={auth}
        onSignIn={signIn}
        inbox={inbox}
        onComplete={() => {
          writeFlag(ONBOARDING_KEY, true);
          setOnboarding(false);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        page={page}
        onNavigate={setPage}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        inboxCount={inbox.counts.total}
        authenticated={auth.authenticated}
        signingIn={auth.signingIn}
        onSignIn={signIn}
        dark={theme.resolved === "dark"}
        onToggleTheme={theme.toggle}
        onShowShortcuts={() => setShowShortcuts(true)}
        version={APP_VERSION}
      />

      <main ref={mainRef} className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
        <div key={page} className="mx-auto w-full max-w-6xl px-8 pt-8 pb-24 animate-in fade-in-0 duration-200">
          {page === "inbox" && (
            <InboxPage
              inbox={inbox}
              activity={activity}
              authenticated={auth.authenticated}
              signingIn={auth.signingIn}
              onSignIn={signIn}
              onPreview={preview.show}
            />
          )}
          {page === "archive" && (
            <ArchivePage
              activity={activity}
              authenticated={auth.authenticated}
              signingIn={auth.signingIn}
              onSignIn={signIn}
              onPreview={preview.show}
              refreshSignal={refreshSignal}
              focusSearchSignal={searchSignal}
            />
          )}
          {page === "settings" && (
            <SettingsPage
              auth={auth}
              onSignIn={signIn}
              inbox={inbox}
              theme={theme}
              version={APP_VERSION}
              onShowShortcuts={() => setShowShortcuts(true)}
            />
          )}
        </div>
      </main>

      <ActivityPanel activity={activity.activity} onStop={activity.stop} onDismiss={activity.dismiss} />
      {preview.element}
      <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
    </div>
  );
}

export default App;

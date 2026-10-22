import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "arkimind-theme";
/** Pre-redesign key: "true" / "false". Read once for migration. */
const LEGACY_KEY = "arkimind-dark-mode";

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) return legacy === "true" ? "dark" : "light";
  } catch {
    // storage unavailable: fall back to the system theme
  }
  return "system";
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);

  useEffect(() => {
    const query = darkQuery();
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  }, [resolved]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // ignore
    }
  }, [preference]);

  const toggle = useCallback(
    () => setPreference(resolved === "dark" ? "light" : "dark"),
    [resolved],
  );

  return { preference, setPreference, resolved, toggle };
}

export type Theme = ReturnType<typeof useTheme>;

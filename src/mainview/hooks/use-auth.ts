import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";

/** Google Drive session state shared by the whole app. */
export function useAuth() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { authenticated } = await api.getAuthStatus();
      setAuthenticated(authenticated);
      return authenticated;
    } catch {
      setAuthenticated(false);
      return false;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setSigningIn(true);
    try {
      const result = await api.login();
      if (result.success) setAuthenticated(true);
      return result;
    } catch (e) {
      return { success: false, error: errorMessage(e) };
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setAuthenticated(false);
  }, []);

  return { authenticated, signingIn, login, logout, refresh };
}

export type Auth = ReturnType<typeof useAuth>;

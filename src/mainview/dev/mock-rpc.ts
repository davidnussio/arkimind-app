/**
 * DEV ONLY — stand-in for `lib/rpc.ts` used by `vite.preview.config.ts`.
 * Lets the webview run in a plain browser without Electrobun globals.
 * Trigger menu shortcuts from the console with `__arkimindShortcut("refresh")`.
 */
type ShortcutListener = (action: string) => void;
const shortcutListeners = new Set<ShortcutListener>();

export function onShortcutAction(listener: ShortcutListener): () => void {
  shortcutListeners.add(listener);
  return () => shortcutListeners.delete(listener);
}

declare global {
  interface Window {
    __arkimindShortcut?: (action: string) => void;
  }
}

window.__arkimindShortcut = (action: string) => {
  for (const listener of shortcutListeners) listener(action);
};

export const electroview = { rpc: null };
export const rpc = null;

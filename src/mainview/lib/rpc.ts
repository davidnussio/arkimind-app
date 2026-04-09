/**
 * Electrobun RPC bridge — webview side.
 * Replaces all HTTP fetch calls with native typed RPC.
 */
import { Electroview } from "electrobun/view";
import type { ArkimindRPC } from "../../shared/types";

type ShortcutListener = (action: string) => void;
const shortcutListeners = new Set<ShortcutListener>();

export function onShortcutAction(listener: ShortcutListener): () => void {
  shortcutListeners.add(listener);
  return () => shortcutListeners.delete(listener);
}

const rpc = Electroview.defineRPC<ArkimindRPC>({
  maxRequestTime: 120_000,
  handlers: {
    requests: {},
    messages: {
      shortcutAction: ({ action }) => {
        for (const listener of shortcutListeners) {
          listener(action);
        }
      },
    },
  },
});

export const electroview = new Electroview({ rpc });

export { rpc };

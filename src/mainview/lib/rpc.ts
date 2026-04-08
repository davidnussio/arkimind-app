/**
 * Electrobun RPC bridge — webview side.
 * Replaces all HTTP fetch calls with native typed RPC.
 */
import { Electroview } from "electrobun/view";
import type { ArkimindRPC } from "../../shared/types";

const rpc = Electroview.defineRPC<ArkimindRPC>({
  maxRequestTime: 120_000,
  handlers: {
    requests: {},
    messages: {},
  },
});

export const electroview = new Electroview({ rpc });

export { rpc };

/**
 * DEV ONLY — serves the webview in a plain browser with an in-memory mock of
 * the Bun RPC API (src/mainview/dev/), so screens can be checked without
 * Electrobun or a Google account. Not used by `start` or `build:*`.
 *
 *   bun run preview:mock   →   http://localhost:5174/?scenario=default
 */
import { defineConfig, type Alias } from "vite";
import path from "node:path";
import base from "./vite.config";

const dev = path.resolve(__dirname, "src/mainview/dev");

export default defineConfig({
  ...base,
  resolve: {
    alias: [
      { find: /^@\/lib\/api$/, replacement: path.join(dev, "mock-api.ts") },
      { find: /^@\/lib\/rpc$/, replacement: path.join(dev, "mock-rpc.ts") },
      ...((base.resolve?.alias ?? []) as Alias[]),
    ],
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});

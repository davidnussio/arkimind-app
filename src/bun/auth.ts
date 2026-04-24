/**
 * Google OAuth2 authentication for Google Drive.
 * Uses credentials.json for desktop app OAuth flow.
 */
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";
import { OAuth2Client } from "google-auth-library";
import * as db from "./db";

export type { OAuth2Client } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

/** Try the preferred port, fall back to a random available one. */
function findAvailablePort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(preferred, () => {
      server.close(() => resolve(preferred));
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Let the OS pick a random available port
        const fallback = http.createServer();
        fallback.listen(0, () => {
          const addr = fallback.address();
          const port = typeof addr === "object" && addr ? addr.port : 0;
          fallback.close(() => {
            if (port) {
              console.warn(
                `[auth] Port ${preferred} in use, using port ${port} instead`,
              );
              resolve(port);
            } else {
              reject(new Error("Could not find an available port"));
            }
          });
        });
        fallback.on("error", reject);
      } else {
        reject(err);
      }
    });
  });
}

const ENV_CREDENTIAL_PATHS = [
  "ARKIMIND_CREDENTIALS_PATH",
  "GOOGLE_OAUTH_CREDENTIALS_PATH",
] as const;

// Look for credentials.json in these locations (in order)
function findCredentialsPath(): string | null {
  // Allow explicit path override for managed deployments.
  for (const envName of ENV_CREDENTIAL_PATHS) {
    const envPath = process.env[envName]?.trim();
    if (!envPath) continue;

    const resolved = path.resolve(envPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }

    console.warn(`[auth] Ignoring ${envName}: file not found at ${resolved}`);
  }

  const candidates = [
    path.join(os.homedir(), ".arkimind", "credentials.json"),
    path.join(process.cwd(), "credentials.json"),
  ];

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;

    // Keep root fallback for backward compatibility, but make it visible.
    if (p === candidates[1]) {
      console.warn(
        "[auth] Using ./credentials.json fallback. Prefer ~/.arkimind/credentials.json",
      );
    }

    return p;
  }

  return null;
}

/** Load saved OAuth2 credentials from the database. */
export function loadSavedClient(): OAuth2Client | null {
  const auth = db.loadAuth();
  if (!auth) return null;

  const client = new OAuth2Client(auth.client_id, auth.client_secret);
  client.setCredentials({ refresh_token: auth.refresh_token });
  return client;
}

/** Check if the user is authenticated. */
export function isAuthenticated(): boolean {
  return db.loadAuth() !== null;
}

/** Run the full browser-based OAuth flow. */
export async function login(): Promise<{ success: boolean; error?: string }> {
  const credentialsPath = findCredentialsPath();
  if (!credentialsPath) {
    return {
      success: false,
      error:
        "credentials.json not found. Place it in ~/.arkimind/credentials.json",
    };
  }

  try {
    // Delete existing auth
    db.deleteAuth();

    // Read client secrets from credentials.json
    const raw = fs.readFileSync(credentialsPath, "utf-8");
    const keys = JSON.parse(raw) as {
      installed?: {
        client_id: string;
        client_secret: string;
        redirect_uris?: string[];
      };
      web?: {
        client_id: string;
        client_secret: string;
        redirect_uris?: string[];
      };
    };
    const key = keys.installed ?? keys.web;
    if (!key) {
      return { success: false, error: "Invalid credentials.json format" };
    }

    // Start local server to receive the OAuth callback.
    // Try port 3000 first, fall back to a random available port.
    const port = await findAvailablePort(3000);
    // Use bare http://localhost:<port> as redirect URI — must match what's
    // registered in credentials.json (Google allows any port for "installed" apps
    // but the path component must match exactly).
    const redirectUri = `http://localhost:${port}`;
    const oauth2Client = new OAuth2Client(
      key.client_id,
      key.client_secret,
      redirectUri,
    );

    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      include_granted_scopes: true,
    });

    // Wait for the authorization code via local HTTP server
    const code = await new Promise<string>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? "/", `http://localhost:${port}`);
        const authCode = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.end("Autenticazione negata.");
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (authCode) {
          res.end("Autenticazione completata! Puoi chiudere questa scheda.");
          server.close();
          resolve(authCode);
        }
      });
      server.listen(port, () => {
        console.log(`[auth] OAuth callback server listening on port ${port}`);
        // Open the browser for consent
        import("open").then((mod) => mod.default(authorizeUrl));
      });
      server.on("error", (err: NodeJS.ErrnoException) => {
        reject(
          new Error(
            `Impossibile avviare il server OAuth sulla porta ${port}: ${err.message}`,
          ),
        );
      });
    });

    console.log("[auth] Exchanging authorization code for tokens...");
    const { tokens } = await oauth2Client.getToken(code);
    console.log("[auth] Token exchange complete. refresh_token present:", !!tokens.refresh_token);

    if (!tokens.refresh_token) {
      return {
        success: false,
        error:
          "Google non ha restituito il refresh token. " +
          "Vai su https://myaccount.google.com/permissions, " +
          "rimuovi l'accesso per Arkimind e riprova.",
      };
    }

    // Save to database
    db.saveAuth({
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: tokens.refresh_token,
    });

    console.log("[auth] Credentials saved successfully");
    return { success: true };
  } catch (e) {
    console.error("[auth] Login failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Autenticazione fallita: ${msg}` };
  }
}

/** Remove saved credentials. */
export function logout(): boolean {
  return db.deleteAuth();
}

/** Get an authorized OAuth2 client, or null if not authenticated. */
export function getAuthClient(): OAuth2Client | null {
  return loadSavedClient();
}

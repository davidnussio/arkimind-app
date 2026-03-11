/**
 * Google OAuth2 authentication for Google Drive.
 * Uses credentials.json for desktop app OAuth flow.
 */
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import * as db from "./db";

export type { OAuth2Client };

const SCOPES = ["https://www.googleapis.com/auth/drive"];

// Look for credentials.json in these locations (in order)
function findCredentialsPath(): string | null {
  const candidates = [
    path.join(os.homedir(), ".arkimind", "credentials.json"),
    path.join(process.cwd(), "credentials.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
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

    // Start local server to receive the OAuth callback
    const redirectUri = "http://localhost:3000/oauth2callback";
    const oauth2Client = new OAuth2Client(
      key.client_id,
      key.client_secret,
      redirectUri,
    );

    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });

    // Wait for the authorization code via local HTTP server
    const code = await new Promise<string>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url!, `http://localhost:3000`);
        const authCode = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.end("Authentication denied.");
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (authCode) {
          res.end("Authentication successful! You can close this tab.");
          server.close();
          resolve(authCode);
        }
      });
      server.listen(3000, () => {
        // Open the browser for consent
        import("open").then((mod) => mod.default(authorizeUrl));
      });
    });

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return { success: false, error: "No refresh token received" };
    }

    // Save to database
    db.saveAuth({
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: tokens.refresh_token,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: `Authentication failed: ${e}` };
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

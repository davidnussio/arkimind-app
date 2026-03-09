/**
 * Google OAuth2 authentication for Google Drive.
 * Uses credentials.json for desktop app OAuth flow.
 */
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import * as db from "./db";

export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

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

  const client = new google.auth.OAuth2(auth.client_id, auth.client_secret);
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

    // Run browser auth flow
    const client = await authenticate({
      scopes: SCOPES,
      keyfilePath: credentialsPath,
    });

    if (!client.credentials?.refresh_token) {
      return { success: false, error: "No refresh token received" };
    }

    // Read client secrets from credentials.json
    const raw = fs.readFileSync(credentialsPath, "utf-8");
    const keys = JSON.parse(raw) as {
      installed?: { client_id: string; client_secret: string };
      web?: { client_id: string; client_secret: string };
    };
    const key = keys.installed ?? keys.web;
    if (!key) {
      return { success: false, error: "Invalid credentials.json format" };
    }

    // Save to database
    db.saveAuth({
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
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

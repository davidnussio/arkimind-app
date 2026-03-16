/**
 * Database service — bun:sqlite for local persistence.
 * Stores auth credentials, settings, inbox folders, and document metadata.
 */
import { Database } from "bun:sqlite";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const APP_DIR = path.join(os.homedir(), ".arkimind");
const DB_PATH = path.join(APP_DIR, "arkidb.sqlite");

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;

  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA synchronous = NORMAL");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      type TEXT NOT NULL,
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS inbox_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drive_folder_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drive_file_id TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      classification_json TEXT,
      category TEXT,
      entity TEXT,
      document_type TEXT,
      document_date TEXT,
      is_tax_relevant INTEGER DEFAULT 0,
      archived_path TEXT,
      archived_filename TEXT,
      status TEXT DEFAULT 'pending',
      inbox_folder_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_docs_category ON documents(category)",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_docs_date ON documents(document_date)",
  );

  // Migrate: add columns that may be missing from older schema
  const columnsToAdd = [
    {
      name: "status",
      sql: "ALTER TABLE documents ADD COLUMN status TEXT DEFAULT 'pending'",
    },
    {
      name: "classification_json",
      sql: "ALTER TABLE documents ADD COLUMN classification_json TEXT",
    },
    { name: "entity", sql: "ALTER TABLE documents ADD COLUMN entity TEXT" },
    {
      name: "document_type",
      sql: "ALTER TABLE documents ADD COLUMN document_type TEXT",
    },
    {
      name: "document_date",
      sql: "ALTER TABLE documents ADD COLUMN document_date TEXT",
    },
    {
      name: "is_tax_relevant",
      sql: "ALTER TABLE documents ADD COLUMN is_tax_relevant INTEGER DEFAULT 0",
    },
    {
      name: "archived_path",
      sql: "ALTER TABLE documents ADD COLUMN archived_path TEXT",
    },
    {
      name: "archived_filename",
      sql: "ALTER TABLE documents ADD COLUMN archived_filename TEXT",
    },
    {
      name: "inbox_folder_id",
      sql: "ALTER TABLE documents ADD COLUMN inbox_folder_id TEXT",
    },
    {
      name: "updated_at",
      sql: "ALTER TABLE documents ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
    },
  ];

  const existingColumns = new Set(
    (
      db.prepare("PRAGMA table_info(documents)").all() as Array<{
        name: string;
      }>
    ).map((r) => r.name),
  );

  for (const col of columnsToAdd) {
    if (!existingColumns.has(col.name)) {
      db.exec(col.sql);
    }
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_docs_status ON documents(status)");
}

// --- Auth ---
export function saveAuth(creds: {
  type: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
}) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO auth (id, type, client_id, client_secret, refresh_token, updated_at)
       VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    .run(creds.type, creds.client_id, creds.client_secret, creds.refresh_token);
}

export function loadAuth(): {
  type: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
} | null {
  return getDb()
    .prepare(
      "SELECT type, client_id, client_secret, refresh_token FROM auth WHERE id = 1",
    )
    .get() as any;
}

export function deleteAuth(): boolean {
  return getDb().prepare("DELETE FROM auth WHERE id = 1").run().changes > 0;
}

// --- Settings ---
export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | null;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
    )
    .run(key, value);
}

export function deleteSetting(key: string) {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export function getAllSettings(): Record<string, string> {
  const rows = getDb()
    .prepare("SELECT key, value FROM settings")
    .all() as Array<{
    key: string;
    value: string;
  }>;
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

// --- Inbox Folders ---
export function getInboxFolders(): Array<{
  id: number;
  drive_folder_id: string;
  name: string;
}> {
  return getDb()
    .prepare(
      "SELECT id, drive_folder_id, name FROM inbox_folders ORDER BY name",
    )
    .all() as any[];
}

export function addInboxFolder(driveFolderId: string, name: string) {
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO inbox_folders (drive_folder_id, name) VALUES (?, ?)",
    )
    .run(driveFolderId, name);
}

export function removeInboxFolder(id: number) {
  getDb().prepare("DELETE FROM inbox_folders WHERE id = ?").run(id);
}

// --- Documents ---
export function saveDocument(doc: {
  driveFileId: string;
  originalName: string;
  mimeType: string;
  classificationJson: string;
  category: string;
  entity: string;
  documentType: string;
  documentDate: string;
  isTaxRelevant: boolean;
  status: string;
  inboxFolderId?: string;
  archivedPath?: string;
  archivedFilename?: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO documents (
        drive_file_id, original_name, mime_type, classification_json,
        category, entity, document_type, document_date, is_tax_relevant,
        status, inbox_folder_id, archived_path, archived_filename, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(drive_file_id) DO UPDATE SET
        classification_json = excluded.classification_json,
        category = excluded.category,
        entity = excluded.entity,
        document_type = excluded.document_type,
        document_date = excluded.document_date,
        is_tax_relevant = excluded.is_tax_relevant,
        status = excluded.status,
        archived_path = COALESCE(excluded.archived_path, archived_path),
        archived_filename = COALESCE(excluded.archived_filename, archived_filename),
        updated_at = CURRENT_TIMESTAMP`,
    )
    .run(
      doc.driveFileId,
      doc.originalName,
      doc.mimeType,
      doc.classificationJson,
      doc.category,
      doc.entity,
      doc.documentType,
      doc.documentDate,
      doc.isTaxRelevant ? 1 : 0,
      doc.status,
      doc.inboxFolderId ?? null,
      doc.archivedPath ?? null,
      doc.archivedFilename ?? null,
    );
}

export function updateDocumentStatus(
  driveFileId: string,
  status: string,
  archivedPath?: string,
  archivedFilename?: string,
  originalName?: string,
) {
  getDb()
    .prepare(
      `UPDATE documents
       SET status = ?, archived_path = COALESCE(?, archived_path),
           archived_filename = COALESCE(?, archived_filename),
           original_name = COALESCE(?, original_name),
           updated_at = CURRENT_TIMESTAMP
       WHERE drive_file_id = ?`,
    )
    .run(
      status,
      archivedPath ?? null,
      archivedFilename ?? null,
      originalName ?? null,
      driveFileId,
    );
}

export function getDocuments(limit = 100): any[] {
  return getDb()
    .prepare("SELECT * FROM documents ORDER BY updated_at DESC LIMIT ?")
    .all(limit);
}

export function searchDocuments(query: string): any[] {
  const pattern = `%${query}%`;
  return getDb()
    .prepare(
      `SELECT * FROM documents
       WHERE category LIKE ? OR entity LIKE ? OR original_name LIKE ?
          OR document_type LIKE ? OR document_date LIKE ?
       ORDER BY updated_at DESC LIMIT 50`,
    )
    .all(pattern, pattern, pattern, pattern, pattern);
}

export function getDocumentByFileId(driveFileId: string): any | null {
  return getDb()
    .prepare("SELECT * FROM documents WHERE drive_file_id = ?")
    .get(driveFileId);
}

export function deleteDocument(driveFileId: string): boolean {
  return (
    getDb()
      .prepare("DELETE FROM documents WHERE drive_file_id = ?")
      .run(driveFileId).changes > 0
  );
}

export function resetDocumentArchiveStatus(driveFileId: string) {
  getDb()
    .prepare(
      `UPDATE documents
       SET archived_path = NULL, archived_filename = NULL,
           status = 'classified', updated_at = CURRENT_TIMESTAMP
       WHERE drive_file_id = ?`,
    )
    .run(driveFileId);
}

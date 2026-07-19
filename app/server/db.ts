/**
 * AYA OS v1.0 — Database Layer
 * Uses sql.js (pure JavaScript SQLite WASM) for zero-native-compilation.
 * Persists to disk at data/aya.db as a binary buffer.
 */

import initSqlJs, { type Database } from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../data/aya.db");
const SCHEMA_PATH = path.resolve(__dirname, "schema.sql");

let _db: Database | null = null;
let _SqlModule: any = null;

// ─── Persist to disk ──────────────────────────────────────────────────────────

export function saveDb(): void {
  if (!_db) return;
  const data = _db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Auto-save every 30 seconds
let _saveInterval: ReturnType<typeof setInterval> | null = null;

// ─── Initialize ───────────────────────────────────────────────────────────────

export async function initDb(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs({
    // sql.js WASM binary location — served from node_modules
    locateFile: (file: string) =>
      path.resolve(__dirname, "../node_modules/sql.js/dist", file),
  });

  _SqlModule = SQL;

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
    log("info", "system", "Database loaded from disk", DB_PATH);
  } else {
    _db = new SQL.Database();
    log("info", "system", "New database created", DB_PATH);
  }

  // Run schema (CREATE TABLE IF NOT EXISTS — safe to re-run)
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  _db.run(schema);
  saveDb();

  // Auto-save every 30 seconds
  _saveInterval = setInterval(saveDb, 30_000);

  return _db;
}

// ─── Public accessor ──────────────────────────────────────────────────────────

export function getDb(): Database {
  if (!_db) throw new Error("Database not initialized. Call initDb() first.");
  return _db;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params as any);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T | null {
  const rows = queryAll<T>(sql, params);
  return rows[0] ?? null;
}

export function run(sql: string, params: unknown[] = []): void {
  const db = getDb();
  db.run(sql, params as any);
}

export function runReturning<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  const db = getDb();
  const result = db.exec(sql, params as any);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as T;
  });
}

// ─── Activity Logging (writes directly to DB) ─────────────────────────────────

export function log(
  level: "info" | "warning" | "error" | "success",
  category: string,
  message: string,
  details?: unknown,
  entityId?: string
): void {
  // Silently skip if DB not ready (during init)
  if (!_db) return;
  try {
    run(
      `INSERT INTO ActivityLog (level, category, message, details, entity_id)
       VALUES (?, ?, ?, ?, ?)`,
      [level, category, message, details ? JSON.stringify(details) : null, entityId ?? null]
    );
  } catch (_) {
    // Never crash on logging failure
  }
}

// ─── Backup ───────────────────────────────────────────────────────────────────

export function backupDb(dest?: string): string {
  const db = getDb();
  const data = db.export();
  const backupPath = dest ?? DB_PATH.replace(".db", `_backup_${Date.now()}.db`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, Buffer.from(data));
  log("success", "system", "Database backed up", { path: backupPath });
  return backupPath;
}

export function restoreDb(sourcePath: string): void {
  if (!fs.existsSync(sourcePath)) throw new Error(`Backup file not found: ${sourcePath}`);
  // First backup current state
  backupDb();
  const fileBuffer = fs.readFileSync(sourcePath);
  const SQL = _SqlModule; // reuse loaded WASM module
  _db = new SQL.Database(fileBuffer);
  saveDb();
  log("success", "system", "Database restored", { source: sourcePath });
}

// ─── Schema version ───────────────────────────────────────────────────────────

export function getSchemaVersion(): Record<string, unknown> | null {
  return queryOne("SELECT * FROM SchemaVersion WHERE id = 1");
}

export function bumpKnowledgeVersion(): void {
  run(
    `UPDATE SchemaVersion SET knowledge_ver = knowledge_ver + 1, updated_at = datetime('now') WHERE id = 1`
  );
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export function closeDb(): void {
  if (_saveInterval) clearInterval(_saveInterval);
  saveDb();
  _db?.close();
  _db = null;
}

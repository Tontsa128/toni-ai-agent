import type Database from "better-sqlite3";

export function verifyDatabase(db: Database.Database): void {
  const rows = db.pragma("integrity_check") as unknown;
  const first = Array.isArray(rows) ? rows[0] : undefined;
  if (!first || typeof first !== "object" || (first as { integrity_check?: unknown }).integrity_check !== "ok") {
    throw new Error("SQLite integrity check failed.");
  }
  const foreignKeys = db.pragma("foreign_key_check") as unknown;
  if (!Array.isArray(foreignKeys) || foreignKeys.length > 0) throw new Error("SQLite foreign key check failed.");
}

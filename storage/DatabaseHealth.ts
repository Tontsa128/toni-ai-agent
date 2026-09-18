import type Database from "better-sqlite3";

export function verifyDatabase(db: Database.Database): void {
  const result = db.pragma("integrity_check").at(0) as { integrity_check: string } | undefined;
  if (result?.integrity_check !== "ok") throw new Error("SQLite integrity check failed.");
  const foreignKeys = db.pragma("foreign_key_check") as unknown[];
  if (foreignKeys.length > 0) throw new Error("SQLite foreign key check failed.");
}

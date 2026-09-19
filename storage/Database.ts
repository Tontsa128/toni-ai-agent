import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export class ToniDatabase {
  private readonly db: Database.Database;

  public constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
  }

  public initialize(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL
    );`);
    for (const filename of ["001_approvals.sql", "002_audit_events.sql"]) {
      const applied = this.db.prepare("SELECT filename FROM schema_migrations WHERE filename = ?").get(filename);
      if (applied) continue;
      const sql = readFileSync(migrationPath(filename), "utf8");
      const transaction = this.db.transaction(() => {
        this.db.exec(sql);
        this.db.prepare("INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)").run(filename, Date.now());
      });
      transaction();
    }
  }

  public connection(): Database.Database { return this.db; }
  public close(): void { if (this.db.open) this.db.close(); }
}
function migrationPath(filename: string): string {
  return fileURLToPath(new URL(`./migrations/${filename}`, import.meta.url));
}

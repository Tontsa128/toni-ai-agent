import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createAppPaths } from "../config/paths.js";

export async function createBackup(): Promise<string> {
  const paths = createAppPaths();
  await mkdir(paths.backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupDirectory = join(paths.backupDirectory, timestamp);
  await mkdir(backupDirectory, { recursive: true });
  await copyFile(paths.databaseFile, join(backupDirectory, basename(paths.databaseFile)));
  await copyDirectoryFiles(paths.auditDirectory, join(backupDirectory, "audit"));
  await copyDirectoryFiles(paths.logDirectory, join(backupDirectory, "logs"));
  await writeFile(join(backupDirectory, "metadata.json"), JSON.stringify({
    createdAt: new Date().toISOString(),
    database: basename(paths.databaseFile),
    schemaMigrations: "stored in SQLite schema_migrations table",
    formatVersion: 1
  }, null, 2), "utf8");
  return backupDirectory;
}

async function copyDirectoryFiles(sourceDirectory: string, destinationDirectory: string): Promise<void> {
  await mkdir(destinationDirectory, { recursive: true });
  let entries;
  try { entries = await readdir(sourceDirectory, { withFileTypes: true }); }
  catch (error: unknown) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const source = join(sourceDirectory, entry.name);
    const destination = join(destinationDirectory, entry.name);
    const information = await stat(source);
    if (information.isFile()) await copyFile(source, destination);
  }
}

if (process.argv[1]?.endsWith("backup.js")) {
  createBackup().then(path => console.log(`Backup created: ${path}`)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Backup failed.");
    process.exitCode = 1;
  });
}

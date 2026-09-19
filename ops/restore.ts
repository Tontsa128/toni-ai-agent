import { access, copyFile, mkdir, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { createAppPaths } from "../config/paths.js";
import { ToniDatabase } from "../storage/Database.js";
import { verifyDatabase } from "../storage/DatabaseHealth.js";
import { verifyAuditChain } from "../agent/audit/verifyAuditChain.js";
import { ProcessLock } from "../app/lifecycle/ProcessLock.js";

export async function restoreBackup(dir: string): Promise<void> {
  const p = createAppPaths();
  const processLock = await ProcessLock.acquire(join(p.dataRoot, "toni-agent.lock"));

  try {
    const source = join(resolve(dir), "toni.sqlite");
    await access(source, constants.R_OK);
    await mkdir(join(p.dataRoot, "database"), { recursive: true });

    const databaseDirectory = join(p.dataRoot, "database");
    const stagedDatabase = join(databaseDirectory, ".restore-staged.sqlite");
    const validationDatabase = join(databaseDirectory, ".restore-validation.sqlite");
    const previousDatabase = join(databaseDirectory, ".toni.sqlite.previous");

    await rm(stagedDatabase, { force: true });
    await rm(validationDatabase, { force: true });
    await rm(previousDatabase, { force: true });

    await copyFile(source, stagedDatabase);
    await validateDatabaseFile(validationDatabase, stagedDatabase);

    // Flush the live WAL before replacing the main database file.
    const liveDatabase = new ToniDatabase(p.databaseFile);
    try {
      liveDatabase.connection().pragma("wal_checkpoint(TRUNCATE)");
    } finally {
      liveDatabase.close();
    }
    await rm(`${p.databaseFile}-wal`, { force: true });
    await rm(`${p.databaseFile}-shm`, { force: true });

    if (process.platform !== "win32") {
      // POSIX rename replaces the destination atomically.
      await rename(stagedDatabase, p.databaseFile);
    } else {
      // Windows cannot atomically rename over an existing open/closed file.
      // Move the live file aside, install the validated file, and roll back if installation fails.
      await rename(p.databaseFile, previousDatabase);
      try {
        await rename(stagedDatabase, p.databaseFile);
        await rm(previousDatabase, { force: true });
      } catch (error) {
        await rm(p.databaseFile, { force: true });
        await rename(previousDatabase, p.databaseFile);
        throw error;
      }
    }

    const restoredDb = new ToniDatabase(p.databaseFile);
    try {
      verifyDatabase(restoredDb.connection());
      verifyAuditChain(restoredDb.connection());
    } finally {
      restoredDb.close();
    }

    await rm(validationDatabase, { force: true });
    await rm(stagedDatabase, { force: true });
  } finally {
    await processLock.release();
  }
}

async function validateDatabaseFile(validationPath: string, stagedPath: string): Promise<void> {
  await copyFile(stagedPath, validationPath);
  const validationDb = new ToniDatabase(validationPath);
  try {
    validationDb.initialize();
    verifyDatabase(validationDb.connection());
    verifyAuditChain(validationDb.connection());
  } finally {
    validationDb.close();
  }
  await rm(validationPath, { force: true });
}

const directory = process.argv[2];
if (process.argv[1]?.endsWith("restore.js")) {
  if (!directory) {
    console.error("Usage: node dist/ops/restore.js <backup-directory>");
    process.exitCode = 2;
  } else {
    restoreBackup(directory)
      .then(() => console.log("Backup restored and validated. Start the application and run readiness checks."))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : "Restore failed.");
        process.exitCode = 1;
      });
  }
}

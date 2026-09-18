import { access, copyFile, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { createAppPaths } from "../config/paths.js";
import { ToniDatabase } from "../storage/Database.js";
import { verifyDatabase } from "../storage/DatabaseHealth.js";
import { verifyAuditChain } from "../agent/audit/verifyAuditChain.js";

export async function restoreBackup(dir: string): Promise<void> {
  const p = createAppPaths();
  const source = join(resolve(dir), "toni.sqlite");
  await access(source, constants.R_OK);
  await mkdir(join(p.dataRoot, "database"), { recursive: true });

  const validationFile = join(p.dataRoot, "database", ".restore-validation.sqlite");
  await rm(validationFile, { force: true });
  await copyFile(source, validationFile);

  const validationDb = new ToniDatabase(validationFile);
  try {
    validationDb.initialize();
    verifyDatabase(validationDb.connection());
    verifyAuditChain(validationDb.connection());
  } finally {
    validationDb.close();
  }
  await rm(validationFile, { force: true });

  const liveDatabase = new ToniDatabase(p.databaseFile);
  liveDatabase.close();
  await copyFile(source, p.databaseFile);
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

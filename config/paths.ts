import { join } from "node:path";

export interface AppPaths {
  dataRoot: string;
  databaseFile: string;
  auditDirectory: string;
  logDirectory: string;
  backupDirectory: string;
  workspaceDirectory: string;
}

export function createAppPaths(dataRoot = process.env.TONI_DATA_ROOT ?? join(process.cwd(), "data")): AppPaths {
  return {
    dataRoot,
    databaseFile: join(dataRoot, "database", "toni.sqlite"),
    auditDirectory: join(dataRoot, "audit"),
    logDirectory: join(dataRoot, "logs"),
    backupDirectory: join(dataRoot, "backups"),
    workspaceDirectory: process.env.TONI_WORKSPACE_ROOT ?? join(dataRoot, "workspace")
  };
}

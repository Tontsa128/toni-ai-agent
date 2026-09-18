import { isAbsolute, join, resolve } from "node:path";

export interface AppPaths {
  dataRoot: string;
  databaseFile: string;
  auditDirectory: string;
  logDirectory: string;
  backupDirectory: string;
  workspaceDirectory: string;
}

export function createAppPaths(dataRoot = process.env.TONI_DATA_ROOT ?? join(process.cwd(), "data")): AppPaths {
  if (process.env.NODE_ENV === "production" && !process.env.TONI_DATA_ROOT) {
    throw new Error("TONI_DATA_ROOT is required in production.");
  }
  const resolvedDataRoot = isAbsolute(dataRoot) ? resolve(dataRoot) : resolve(process.cwd(), dataRoot);
  const workspaceDirectory = process.env.TONI_WORKSPACE_ROOT
    ? resolve(process.env.TONI_WORKSPACE_ROOT)
    : join(resolvedDataRoot, "workspace");

  return {
    dataRoot: resolvedDataRoot,
    databaseFile: join(resolvedDataRoot, "database", "toni.sqlite"),
    auditDirectory: join(resolvedDataRoot, "audit"),
    logDirectory: join(resolvedDataRoot, "logs"),
    backupDirectory: join(resolvedDataRoot, "backups"),
    workspaceDirectory
  };
}

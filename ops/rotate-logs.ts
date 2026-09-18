import { mkdir, readdir, rename, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { createAppPaths } from "../config/paths.js";

const MAX_LOG_BYTES = 10 * 1024 * 1024;
export async function rotateLogs(): Promise<void> {
  const paths = createAppPaths();
  await mkdir(paths.logDirectory, { recursive: true });
  for (const entry of await readdir(paths.logDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".log")) continue;
    const path = join(paths.logDirectory, entry.name);
    if ((await stat(path)).size <= MAX_LOG_BYTES) continue;
    await rename(path, join(dirname(path), `${basename(path)}.${Date.now()}`));
  }
}
if (process.argv[1]?.endsWith("rotate-logs.js")) rotateLogs().then(() => console.log("Logs rotated.")).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Log rotation failed."); process.exitCode = 1;
});

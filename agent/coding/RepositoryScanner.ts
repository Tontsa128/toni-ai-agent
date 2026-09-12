import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";

export interface RepositoryFile {
  path: string;
  bytes: number;
}

export interface RepositoryMap {
  workspace: string;
  files: RepositoryFile[];
  directories: string[];
  configFiles: string[];
  sourceDirectories: string[];
  testDirectories: string[];
  packageScripts: Record<string, string>;
}

const IGNORED_DIRECTORIES = new Set([
  ".git", "node_modules", "dist", "build", ".next", ".turbo", "coverage", "out", "target", "__pycache__", ".venv", "venv"
]);

const IGNORED_FILE_NAMES = new Set([
  ".env", ".env.local", ".env.development", ".env.production", ".env.test", "id_rsa", "id_ed25519"
]);

const CONFIG_NAMES = new Set([
  "package.json", "tsconfig.json", "tsconfig.base.json", "pnpm-workspace.yaml", "turbo.json", "nx.json",
  "vite.config.ts", "vite.config.js", "next.config.ts", "next.config.js", "next.config.mjs",
  "pyproject.toml", "requirements.txt", "Dockerfile", "docker-compose.yml", ".github/workflows/ci.yml"
]);

function isIgnoredFile(name: string): boolean {
  if (IGNORED_FILE_NAMES.has(name)) return true;
  return name.startsWith(".env.") && name !== ".env.example";
}

export class RepositoryScanner {
  constructor(private readonly workspace: string) {}

  async scan(): Promise<RepositoryMap> {
    const root = path.resolve(this.workspace);
    const files: RepositoryFile[] = [];
    const directories = new Set<string>();

    await this.walk(root, root, files, directories);
    files.sort((a, b) => a.path.localeCompare(b.path));

    const configFiles = files.filter((file) => CONFIG_NAMES.has(file.path) || file.path.startsWith(".github/workflows/"))
      .map((file) => file.path);
    const sourceDirectories = [...directories].filter((dir) => /(^|\/)(src|app|agent|tools|computer|school|ai-platform|apps)(\/|$)/.test(dir));
    const testDirectories = [...directories].filter((dir) => /(^|\/)(test|tests|__tests__)(\/|$)/.test(dir));

    return {
      workspace: root,
      files,
      directories: [...directories].sort(),
      configFiles,
      sourceDirectories: sourceDirectories.sort(),
      testDirectories: testDirectories.sort(),
      packageScripts: await this.readPackageScripts(root)
    };
  }

  summarize(map: RepositoryMap): string {
    const lines = [
      `Workspace: ${map.workspace}`,
      `Files: ${map.files.length}`,
      `Directories: ${map.directories.length}`,
      `Config: ${map.configFiles.join(", ") || "none"}`,
      `Source dirs: ${map.sourceDirectories.join(", ") || "none"}`,
      `Test dirs: ${map.testDirectories.join(", ") || "none"}`,
      `Scripts: ${Object.entries(map.packageScripts).map(([key, value]) => `${key}=${value}`).join("; ") || "none"}`,
      "",
      "Files:",
      ...map.files.slice(0, 300).map((file) => `- ${file.path} (${file.bytes} B)`)
    ];
    if (map.files.length > 300) lines.push(`- ... ${map.files.length - 300} more files omitted`);
    return lines.join("\n");
  }

  private async walk(root: string, current: string, files: RepositoryFile[], directories: Set<string>): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        const absolute = path.join(current, entry.name);
        const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
        directories.add(relative);
        await this.walk(root, absolute, files, directories);
        continue;
      }
      if (!entry.isFile() || isIgnoredFile(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
      const info = await stat(absolute);
      files.push({ path: relative, bytes: info.size });
    }
  }

  private async readPackageScripts(root: string): Promise<Record<string, string>> {
    try {
      const raw = await readFile(path.join(root, "package.json"), "utf8");
      const parsed = JSON.parse(raw) as { scripts?: Record<string, unknown> };
      return Object.fromEntries(Object.entries(parsed.scripts ?? {}).filter(([, value]) => typeof value === "string")) as Record<string, string>;
    } catch {
      return {};
    }
  }
}

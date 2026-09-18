import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const roots = ["agent", "app", "tools"];
const rules = [
  { name: "child_process.exec", pattern: /\b(?:child_process\.)?exec\s*\(/g },
  { name: "child_process.execFile", pattern: /\b(?:child_process\.)?execFile\s*\(/g },
  { name: "child_process.spawn", pattern: /\b(?:child_process\.)?spawn\s*\(/g },
  { name: "child_process.fork", pattern: /\b(?:child_process\.)?fork\s*\(/g },
  { name: "page.click", pattern: /\bpage\.click\s*\(/g },
  { name: "computerAdapter.click", pattern: /\bcomputerAdapter\.click\s*\(/g }
];

const allowed = new Map([
  ["agent/worker/WorkerProcess.ts", new Set(["child_process.spawn"])],
  ["agent/worker/WorkerClient.ts", new Set(["child_process.fork"])],
  ["agent/worker/WindowsJobController.ts", new Set(["child_process.spawn"])]
]);

const violations = [];

async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await scan(filePath);
      continue;
    }
    if (!/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) continue;
    const rel = relative(process.cwd(), filePath).replaceAll("\\", "/");
    const content = await readFile(filePath, "utf8");
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(content)) continue;
      if (allowed.get(rel)?.has(rule.name)) continue;
      violations.push(`${rel}: forbidden ${rule.name}`);
    }
  }
}

for (const root of roots) {
  try {
    await scan(root);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

if (violations.length) {
  console.error("Security boundary violations:");
  for (const violation of [...new Set(violations)].sort()) console.error(`- ${violation}`);
  process.exit(1);
}
console.log("Security boundary scan passed.");

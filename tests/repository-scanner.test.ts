import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RepositoryScanner } from "../agent/coding/RepositoryScanner.js";

test("RepositoryScanner ignores generated, dependency and secret files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "toni-scanner-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
  await mkdir(path.join(root, ".git"), { recursive: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  await writeFile(path.join(root, "src", "index.ts"), "export const ok = true;", "utf8");
  await writeFile(path.join(root, ".env"), "SECRET=do-not-scan", "utf8");
  await writeFile(path.join(root, ".env.example"), "SECRET=example", "utf8");
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { check: "tsc --noEmit" } }), "utf8");
  await writeFile(path.join(root, "node_modules", "pkg", "index.js"), "secret", "utf8");

  const map = await new RepositoryScanner(root).scan();
  const paths = map.files.map((file) => file.path);
  assert.deepEqual(paths, [".env.example", "package.json", "src/index.ts"]);
  assert.deepEqual(map.packageScripts, { check: "tsc --noEmit" });
  assert.deepEqual(map.configFiles, ["package.json"]);
  assert.ok(map.sourceDirectories.includes("src"));
});

test("RepositoryScanner summary contains metadata but no file contents", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "toni-scanner-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
  await writeFile(path.join(root, "notes.txt"), "DO_NOT_LEAK_THIS_CONTENT", "utf8");

  const scanner = new RepositoryScanner(root);
  const summary = scanner.summarize(await scanner.scan());
  assert.match(summary, /notes\.txt/);
  assert.match(summary, /test=node --test/);
  assert.doesNotMatch(summary, /DO_NOT_LEAK_THIS_CONTENT/);
});

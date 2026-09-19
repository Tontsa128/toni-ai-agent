import test from "node:test";
import assert from "node:assert/strict";
import { basename, dirname } from "node:path";
import { migrationPath } from "../../storage/Database.js";

test("database migrations resolve beside the compiled Database module, not process.cwd", () => {
  const path = migrationPath("001_approvals.sql");
  assert.equal(basename(path), "001_approvals.sql");
  assert.match(dirname(path), /storage[\\/]migrations$/);
});

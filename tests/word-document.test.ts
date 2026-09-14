import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createWordDocument } from "../agent/tools/WordDocumentTool.js";

test("creates a real workspace-bounded DOCX file", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "toni-ai-word-"));
  try {
    const result = await createWordDocument(workspace, {
      relativePath: "documents/test.docx",
      title: "Toni AI Agent",
      content: "Ensimmäinen kappale.\nToinen kappale."
    });

    const bytes = await readFile(result.path);
    assert.equal(result.format, "docx");
    assert.ok(bytes.length > 100);
    assert.deepEqual([...bytes.subarray(0, 2)], [0x50, 0x4b]);
    assert.equal(result.path, join(workspace, "documents", "test.docx"));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("rejects a DOCX path that escapes the workspace", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "toni-ai-word-"));
  try {
    await assert.rejects(
      createWordDocument(workspace, {
        relativePath: "../outside.docx",
        content: "ei pitäisi onnistua"
      }),
      /Path escapes workspace/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

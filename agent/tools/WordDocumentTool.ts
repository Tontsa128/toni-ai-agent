import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export interface WordDocumentInput {
  relativePath: string;
  title?: string;
  content: string;
}

export interface WordDocumentResult {
  path: string;
  bytes: number;
  format: "docx";
}

export async function createWordDocument(workspace: string, input: WordDocumentInput): Promise<WordDocumentResult> {
  if (!input.relativePath || !input.relativePath.toLowerCase().endsWith(".docx")) {
    throw new Error("Word-tiedoston polun täytyy päättyä .docx");
  }
  if (typeof input.content !== "string" || !input.content.trim()) {
    throw new Error("content is required");
  }
  if (Buffer.byteLength(input.content, "utf8") > MAX_TEXT_BYTES) {
    throw new Error("Word-sisältö on liian suuri (max 2 MB tekstinä).");
  }

  const root = resolve(workspace);
  const target = resolve(root, input.relativePath);
  if (target !== root && !target.startsWith(`${root}/`) && !target.startsWith(`${root}\\`)) {
    throw new Error("Path escapes workspace");
  }

  const paragraphs = input.content.split(/\r?\n/).map((line) =>
    new Paragraph({ children: [new TextRun(line)] })
  );

  const children = input.title?.trim()
    ? [new Paragraph({ text: input.title.trim(), heading: HeadingLevel.TITLE }), ...paragraphs]
    : paragraphs;

  const document = new Document({
    creator: "Toni AI Agent",
    title: input.title?.trim() || "Toni AI Agent document",
    sections: [{ children }]
  });

  const buffer = await Packer.toBuffer(document);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buffer);
  try {
    await chmod(target, 0o600);
  } catch {
    // Windows may not expose POSIX file modes; the file is still workspace-bounded.
  }

  return { path: target, bytes: buffer.byteLength, format: "docx" };
}

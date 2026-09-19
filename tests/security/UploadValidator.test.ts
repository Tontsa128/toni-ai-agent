import test from "node:test";
import assert from "node:assert/strict";
import { validateUpload } from "../../app/security/UploadValidator.js";

test("upload validator accepts a valid PDF signature", () => {
  assert.doesNotThrow(() => validateUpload("report.pdf", "application/pdf", Buffer.from("%PDF-1.7\n"), 20_000_000));
});

test("upload validator rejects spoofed image content", () => {
  assert.throws(() => validateUpload("photo.png", "image/png", Buffer.from("not an image"), 20_000_000), /does not match/);
});

test("upload validator rejects executable and archive media types", () => {
  assert.throws(() => validateUpload("app.exe", "application/octet-stream", Buffer.from("MZ"), 20_000_000), /Unsupported/);
  assert.throws(() => validateUpload("archive.zip", "application/zip", Buffer.from("PK"), 20_000_000), /Unsupported/);
});

test("upload validator rejects unsafe filenames", () => {
  assert.throws(() => validateUpload("../secret.txt", "text/plain", Buffer.from("x"), 20_000_000), /filename/);
});

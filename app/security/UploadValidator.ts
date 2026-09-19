const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "text/plain", "text/markdown", "text/csv", "application/json",
  "text/javascript", "text/css", "text/html", "application/xml"
]);

export function validateUpload(filename: string, mediaType: string, content: Buffer, maxBytes: number): void {
  if (!filename || filename.length > 255 || filename.includes("\0") || filename.includes("/") || filename.includes("\\")) {
    throw new Error("Invalid attachment filename.");
  }
  if (content.length === 0) throw new Error("Attachment is empty.");
  if (content.length > maxBytes) throw new Error("Attachment exceeds the configured size limit.");
  const normalized = mediaType.toLowerCase().trim();
  if (!ALLOWED_MEDIA_TYPES.has(normalized)) throw new Error(`Unsupported attachment type: ${normalized || "unknown"}.`);
  if (normalized.startsWith("image/") && !hasValidImageSignature(normalized, content)) {
    throw new Error("Image content does not match its declared media type.");
  }
  if (normalized === "application/pdf" && !content.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("PDF content does not match its declared media type.");
  }
}

function hasValidImageSignature(mediaType: string, content: Buffer): boolean {
  if (mediaType === "image/jpeg") return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  if (mediaType === "image/png") return content.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mediaType === "image/gif") return content.subarray(0, 6).equals(Buffer.from("GIF87a")) || content.subarray(0, 6).equals(Buffer.from("GIF89a"));
  if (mediaType === "image/webp") return content.length >= 12 && content.subarray(0, 4).equals(Buffer.from("RIFF")) && content.subarray(8, 12).equals(Buffer.from("WEBP"));
  return false;
}

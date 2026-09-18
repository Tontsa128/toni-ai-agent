import { createHash } from "node:crypto";

export function hashToolCall(toolName: string, input: unknown): string {
  const canonical = JSON.stringify(input, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((out, key) => {
        out[key] = (value as Record<string, unknown>)[key];
        return out;
      }, {});
    }
    return value;
  });
  return createHash("sha256").update(toolName).update("\0").update(canonical ?? "null").digest("hex");
}

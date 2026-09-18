export interface FilterResult { blocked: boolean; value: string; reasons: string[]; }
const BLOCK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "api-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { name: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi },
  { name: "credit-card-like", pattern: /\b(?:\d[ -]*?){13,19}\b/g }
];
export function filterSensitiveContent(value: string): FilterResult {
  const reasons: string[] = [];
  let filtered = value;
  for (const item of BLOCK_PATTERNS) {
    item.pattern.lastIndex = 0;
    if (item.pattern.test(value)) { reasons.push(item.name); item.pattern.lastIndex = 0; filtered = filtered.replace(item.pattern, "[REDACTED]"); }
  }
  return { blocked: reasons.length > 0, value: filtered, reasons };
}

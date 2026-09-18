export function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Tool input must be a JSON object.");
  return value as Record<string, unknown>;
}
export function requireFiniteNumber(object: Record<string, unknown>, key: string): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${key} must be a finite number.`);
  return value;
}
export function requireBoundedString(object: Record<string, unknown>, key: string, maximumLength: number): string {
  const value = object[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximumLength) throw new Error(`${key} must be a non-empty string with maximum length ${maximumLength}.`);
  return value.trim();
}

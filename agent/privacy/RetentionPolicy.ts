export interface RetentionPolicy {
  auditDays: number;
  sessionDays: number;
  ocrTextMinutes: number;
  approvalDays: number;
  keepRawScreenshots: false;
}
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = { auditDays: 30, sessionDays: 7, ocrTextMinutes: 5, approvalDays: 1, keepRawScreenshots: false };
export function validateRetentionPolicy(policy: RetentionPolicy): void {
  if (!Number.isInteger(policy.auditDays) || policy.auditDays < 1 || policy.auditDays > 365) throw new Error("auditDays must be between 1 and 365.");
  if (!Number.isInteger(policy.sessionDays) || policy.sessionDays < 0 || policy.sessionDays > 90) throw new Error("sessionDays must be between 0 and 90.");
  if (!Number.isInteger(policy.ocrTextMinutes) || policy.ocrTextMinutes < 0 || policy.ocrTextMinutes > 60) throw new Error("ocrTextMinutes must be between 0 and 60.");
  if (policy.keepRawScreenshots !== false) throw new Error("Raw screenshots must not be retained.");
}

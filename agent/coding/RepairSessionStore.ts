import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RepairPlan } from "../debug/SelfDebugger.js";
import type { VerificationResult, VerificationStepResult } from "./VerificationEngine.js";
import type { RepairSessionSnapshot } from "./RepairSession.js";

const MAX_TEXT = 1000;
const SCHEMA_VERSION = 1;

interface PersistedRepairSession {
  schemaVersion: number;
  sessionId: string;
  updatedAt: string;
  state: RepairSessionSnapshot["state"];
  attempt: number;
  verification?: SanitizedVerificationResult;
  repairPlan?: RepairPlan;
  approval?: RepairSessionSnapshot["approval"];
  reason?: string;
}
interface SanitizedVerificationResult { ok: boolean; steps: SanitizedVerificationStepResult[]; failedStep?: SanitizedVerificationStepResult; }
interface SanitizedVerificationStepResult {
  name: VerificationStepResult["name"];
  command: string;
  ok: boolean;
  skipped: boolean;
  exitCode?: number | null;
  reason?: string;
}

/** File-backed repair state. Raw stdout/stderr and model output are never persisted. */
export class RepairSessionStore {
  constructor(private readonly filePath: string) {}

  load(sessionId: string): RepairSessionSnapshot | undefined {
    if (!existsSync(this.filePath)) return undefined;
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<PersistedRepairSession>;
      if (raw.schemaVersion !== SCHEMA_VERSION || raw.sessionId !== sessionId) return undefined;
      const attempt = raw.attempt;
      if (!this.isState(raw.state) || !Number.isInteger(attempt) || attempt < 1) return undefined;
      const snapshot: RepairSessionSnapshot = { state: raw.state, attempt };
      if (raw.verification) snapshot.verification = raw.verification as VerificationResult;
      if (raw.repairPlan) snapshot.repairPlan = raw.repairPlan;
      if (raw.approval) snapshot.approval = raw.approval;
      if (raw.reason) snapshot.reason = raw.reason;
      return snapshot;
    } catch { return undefined; }
  }

  save(sessionId: string, snapshot: RepairSessionSnapshot): void {
    const payload: PersistedRepairSession = {
      schemaVersion: SCHEMA_VERSION,
      sessionId,
      updatedAt: new Date().toISOString(),
      state: snapshot.state,
      attempt: snapshot.attempt
    };
    if (snapshot.verification) payload.verification = this.sanitizeVerification(snapshot.verification);
    if (snapshot.repairPlan) payload.repairPlan = this.sanitizePlan(snapshot.repairPlan);
    if (snapshot.approval) payload.approval = {
      actionId: this.safeText(snapshot.approval.actionId),
      attempt: snapshot.approval.attempt,
      description: this.safeText(snapshot.approval.description)
    };
    if (snapshot.reason) payload.reason = this.safeText(snapshot.reason);

    const directory = dirname(this.filePath);
    mkdirSync(directory, { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    try {
      writeFileSync(tempPath, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
      renameSync(tempPath, this.filePath);
    } catch (error) {
      try { unlinkSync(tempPath); } catch { /* best effort cleanup */ }
      throw error;
    }
  }

  clear(): void {
    try { unlinkSync(this.filePath); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "ENOENT") throw error;
    }
  }

  private sanitizeVerification(result: VerificationResult): SanitizedVerificationResult {
    const sanitizeStep = (step: VerificationStepResult): SanitizedVerificationStepResult => {
      const output: SanitizedVerificationStepResult = {
        name: step.name, command: this.safeText(step.command), ok: step.ok, skipped: step.skipped
      };
      if (step.exitCode !== undefined) output.exitCode = step.exitCode;
      if (step.reason) output.reason = this.safeText(step.reason);
      return output;
    };
    const output: SanitizedVerificationResult = { ok: result.ok, steps: result.steps.map(sanitizeStep) };
    if (result.failedStep) output.failedStep = sanitizeStep(result.failedStep);
    return output;
  }

  private sanitizePlan(plan: RepairPlan): RepairPlan {
    return {
      outcome: plan.outcome,
      summary: this.safeText(plan.summary),
      suspectedCause: this.safeText(plan.suspectedCause),
      nextChecks: plan.nextChecks.slice(0, 10).map((item) => this.safeText(item)),
      safeToRetry: plan.safeToRetry
    };
  }

  private safeText(value: string): string {
    return value
      .replace(/(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+/gi, "[REDACTED]")
      .replace(/((?:api[_-]?key|token|password|secret|authorization))\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
      .replace(/bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
      .slice(0, MAX_TEXT);
  }

  private isState(value: unknown): value is RepairSessionSnapshot["state"] {
    return value === "verifying" || value === "needs_repair" || value === "waiting_approval" ||
      value === "repairing" || value === "succeeded" || value === "failed" || value === "rejected";
  }
}

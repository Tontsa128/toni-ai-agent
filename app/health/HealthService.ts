import type { StartupState } from "../lifecycle/StartupState.js";

export interface HealthStatus {
  status: "ok" | "degraded";
  timestamp: string;
  checks: { configuration: "ok" | "failed"; approvalStore: "ok" | "failed"; model: "configured" | "missing"; runtime: "ready" | "not_ready" };
}
export class HealthService {
  constructor(private readonly state: { configurationReady: boolean; approvalStoreReady: boolean; modelConfigured: boolean; startupState?: StartupState }) {}
  getStatus(): HealthStatus {
    const configuration = this.state.configurationReady ? "ok" : "failed";
    const approvalStore = this.state.approvalStoreReady ? "ok" : "failed";
    const model = this.state.modelConfigured ? "configured" : "missing";
    const runtime = this.state.startupState?.isReady() ? "ready" : "not_ready";
    const healthy = configuration === "ok" && approvalStore === "ok" && model === "configured" && runtime === "ready";
    return { status: healthy ? "ok" : "degraded", timestamp: new Date().toISOString(), checks: { configuration, approvalStore, model, runtime } };
  }
}

export interface HealthStatus {
  status: "ok" | "degraded";
  timestamp: string;
  checks: {
    configuration: "ok" | "failed";
    approvalStore: "ok" | "failed";
    model: "configured" | "missing";
  };
}

export class HealthService {
  constructor(private readonly state: {
    configurationReady: boolean;
    approvalStoreReady: boolean;
    modelConfigured: boolean;
  }) {}

  getStatus(): HealthStatus {
    const configuration = this.state.configurationReady ? "ok" : "failed";
    const approvalStore = this.state.approvalStoreReady ? "ok" : "failed";
    const model = this.state.modelConfigured ? "configured" : "missing";
    const healthy = configuration === "ok" && approvalStore === "ok" && model === "configured";
    return {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: { configuration, approvalStore, model }
    };
  }
}

export interface MetricsSnapshot {
  requestsTotal: number; requestsFailed: number; toolCallsTotal: number; toolCallsDenied: number;
  approvalsCreated: number; approvalsConsumed: number; toolDurationTotalMs: number; activeSessions: number;
}
export class Metrics {
  private requestsTotal = 0; private requestsFailed = 0; private toolCallsTotal = 0; private toolCallsDenied = 0;
  private approvalsCreated = 0; private approvalsConsumed = 0; private toolDurationTotalMs = 0; private activeSessions = 0;
  public requestStarted(): void { this.requestsTotal += 1; }
  public requestFailed(): void { this.requestsFailed += 1; }
  public toolStarted(): void { this.toolCallsTotal += 1; }
  public toolDenied(): void { this.toolCallsDenied += 1; }
  public approvalCreated(): void { this.approvalsCreated += 1; }
  public approvalConsumed(): void { this.approvalsConsumed += 1; }
  public toolFinished(durationMs: number): void { this.toolDurationTotalMs += Math.max(0, durationMs); }
  public sessionStarted(): void { this.activeSessions += 1; }
  public sessionEnded(): void { this.activeSessions = Math.max(0, this.activeSessions - 1); }
  public snapshot(): MetricsSnapshot {
    return { requestsTotal:this.requestsTotal, requestsFailed:this.requestsFailed, toolCallsTotal:this.toolCallsTotal,
      toolCallsDenied:this.toolCallsDenied, approvalsCreated:this.approvalsCreated, approvalsConsumed:this.approvalsConsumed,
      toolDurationTotalMs:this.toolDurationTotalMs, activeSessions:this.activeSessions };
  }
}

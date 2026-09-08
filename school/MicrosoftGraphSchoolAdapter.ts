export interface MicrosoftGraphConfig {
  accessToken?: string;
  graphBaseUrl?: string;
}

export interface GraphItem {
  id: string;
  displayName?: string;
  [key: string]: unknown;
}

/**
 * Read-focused Microsoft Graph adapter for school work.
 * Access tokens are supplied by the host process and are never accepted from model text.
 * Write/submit operations are intentionally not exposed here; they belong behind the
 * approval workflow and should be added only with the exact school tenant permissions.
 */
export class MicrosoftGraphSchoolAdapter {
  private readonly baseUrl: string;

  constructor(private readonly config: MicrosoftGraphConfig) {
    this.baseUrl = config.graphBaseUrl ?? "https://graph.microsoft.com/v1.0";
  }

  private token(): string {
    if (!this.config.accessToken) throw new Error("Microsoft Graph access token is not configured");
    return this.config.accessToken;
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token()}`, Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Microsoft Graph GET failed: HTTP ${response.status}`);
    }
    return await response.json() as T;
  }

  async listClasses(): Promise<GraphItem[]> {
    const result = await this.get<{ value: GraphItem[] }>("/education/classes");
    return result.value;
  }

  async listAssignments(classId: string): Promise<GraphItem[]> {
    const safeClassId = encodeURIComponent(classId);
    const result = await this.get<{ value: GraphItem[] }>(`/education/classes/${safeClassId}/assignments`);
    return result.value;
  }

  async getAssignment(classId: string, assignmentId: string): Promise<GraphItem> {
    const safeClassId = encodeURIComponent(classId);
    const safeAssignmentId = encodeURIComponent(assignmentId);
    return await this.get<GraphItem>(`/education/classes/${safeClassId}/assignments/${safeAssignmentId}`);
  }
}

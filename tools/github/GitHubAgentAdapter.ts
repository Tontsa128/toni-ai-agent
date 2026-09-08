import { request } from "node:https";

export interface GitHubClientConfig {
  owner: string;
  repo: string;
  token?: string;
}

export interface PullRequestDraft {
  title: string;
  body: string;
  head: string;
  base: string;
}

export class GitHubAgentAdapter {
  constructor(private readonly config: GitHubClientConfig) {}

  async createPullRequest(input: PullRequestDraft): Promise<{ number: number; url: string }> {
    if (!this.config.token) throw new Error("GITHUB_TOKEN is required for GitHub write operations");
    const payload = JSON.stringify({ title: input.title, body: input.body, head: input.head, base: input.base });
    const response = await this.call("POST", `/repos/${this.config.owner}/${this.config.repo}/pulls`, payload);
    return { number: response.number as number, url: response.html_url as string };
  }

  async addComment(issueOrPullNumber: number, body: string): Promise<void> {
    if (!this.config.token) throw new Error("GITHUB_TOKEN is required for GitHub write operations");
    await this.call("POST", `/repos/${this.config.owner}/${this.config.repo}/issues/${issueOrPullNumber}/comments`, JSON.stringify({ body }));
  }

  private call(method: string, path: string, body: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const req = request({ hostname: "api.github.com", path, method, headers: {
        "User-Agent": "toni-ai-agent",
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }}, res => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => {
          let parsed: Record<string, unknown>;
          try { parsed = JSON.parse(data) as Record<string, unknown>; } catch { reject(new Error("GitHub returned invalid JSON")); return; }
          if ((res.statusCode ?? 500) >= 400) { reject(new Error(`GitHub API ${res.statusCode}: ${String(parsed.message ?? "request failed")}`)); return; }
          resolve(parsed);
        });
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}

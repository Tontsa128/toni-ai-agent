export interface StartupCheck { name: string; requiredInProduction: boolean; run(): Promise<void>; }
export interface StartupCheckResult { name: string; ok: boolean; error?: string; }
export async function runStartupChecks(checks: StartupCheck[], production: boolean): Promise<StartupCheckResult[]> {
  const results: StartupCheckResult[] = [];
  for (const check of checks) {
    try { await check.run(); results.push({ name: check.name, ok: true }); }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Startup check failed.";
      results.push({ name: check.name, ok: false, error: message });
      if (production && check.requiredInProduction) throw new Error("Required startup check failed: " + check.name + ": " + message, { cause: error });
    }
  }
  return results;
}
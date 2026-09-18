import { Buffer } from "node:buffer";

export type AppEnvironment = "development" | "test" | "production";

export interface AppConfig {
  environment: AppEnvironment;
  host: string;
  port: number;
  openAiApiKey?: string;
  openAiModel: string;
  approvalTtlMs: number;
  maxRequestBytes: number;
  maxToolCalls: number;
  commandTimeoutMs: number;
  screenMonitoringEnabled: boolean;
  authToken?: string;
  workerMemoryMb: number;
  workerMaxProcesses: number;
  workerCpuTimeMs: number;
  windowsJobHelperPath?: string;
  windowsTrustedRoot: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxSessionUsd: number;
  maxProviderRequests: number;
  auditRetentionDays: number;
  sessionRetentionDays: number;
  ocrRetentionMinutes: number;
  keepRawScreenshots: false;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = source.NODE_ENV === "production"
    ? "production"
    : source.NODE_ENV === "test" ? "test" : "development";
  const openAiModel = source.OPENAI_MODEL?.trim();
  if (!openAiModel) throw new Error("OPENAI_MODEL is required.");
  const openAiApiKey = source.OPENAI_API_KEY?.trim();
  if (environment === "production" && !openAiApiKey) throw new Error("OPENAI_API_KEY is required in production.");
  const authToken = source.TONI_AUTH_TOKEN?.trim();
  if (environment === "production" && !authToken) throw new Error("TONI_AUTH_TOKEN is required in production.");
  return {
    environment,
    host: source.HOST?.trim() || "127.0.0.1",
    port: parseInteger(source.PORT, 8787, 1, 65535),
    ...(openAiApiKey ? { openAiApiKey } : {}),
    openAiModel,
    approvalTtlMs: parseInteger(source.TONI_APPROVAL_TTL_MS, 120_000, 1_000, 3_600_000),
    maxRequestBytes: parseInteger(source.TONI_MAX_REQUEST_BYTES, 1_048_576, 1_024, 10_485_760),
    maxToolCalls: parseInteger(source.TONI_MAX_TOOL_CALLS, 8, 1, 100),
    commandTimeoutMs: parseInteger(source.TONI_COMMAND_TIMEOUT_MS, 30_000, 100, 300_000),
    screenMonitoringEnabled: source.TONI_SCREEN_MONITORING === "true",
    ...(source.TONI_AUTH_TOKEN?.trim() ? { authToken: source.TONI_AUTH_TOKEN.trim() } : {}),
    workerMemoryMb: parseInteger(source.TONI_WORKER_MEMORY_MB, 512, 64, 4096),
    workerMaxProcesses: parseInteger(source.TONI_WORKER_MAX_PROCESSES, 16, 1, 256),
    workerCpuTimeMs: parseInteger(source.TONI_WORKER_CPU_TIME_MS, 30_000, 100, 300_000),
    ...(source.TONI_JOB_HELPER_PATH?.trim() ? { windowsJobHelperPath: source.TONI_JOB_HELPER_PATH.trim() } : {}),
    windowsTrustedRoot: source.TONI_TRUSTED_INSTALL_ROOT?.trim() || process.cwd(),
    maxInputTokens: parseInteger(source.TONI_MAX_INPUT_TOKENS, 20_000, 1, 1_000_000),
    maxOutputTokens: parseInteger(source.TONI_MAX_OUTPUT_TOKENS, 5_000, 1, 128_000),
    maxSessionUsd: parseFloatValue(source.TONI_MAX_SESSION_USD, 1, 0.01, 1000),
    maxProviderRequests: parseInteger(source.TONI_MAX_PROVIDER_REQUESTS, 20, 1, 1000),
    auditRetentionDays: parseInteger(source.TONI_AUDIT_RETENTION_DAYS, 30, 1, 365),
    sessionRetentionDays: parseInteger(source.TONI_SESSION_RETENTION_DAYS, 7, 0, 90),
    ocrRetentionMinutes: parseInteger(source.TONI_OCR_RETENTION_MINUTES, 5, 0, 60),
    keepRawScreenshots: source.TONI_KEEP_RAW_SCREENSHOTS === "true" ? (() => { throw new Error("Raw screenshots cannot be enabled."); })() : false
  };
}

function parseFloatValue(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`Configuration value must be between ${minimum} and ${maximum}.`);
  return parsed;
}

function parseInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Configuration value must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function parseMemoryKey(value: string | undefined): Buffer | undefined {
  if (!value) return undefined;
  if (!/^[0-9a-fA-F]+$/.test(value)) throw new Error("TONI_MEMORY_KEY must contain only hexadecimal characters.");
  const key = Buffer.from(value, "hex");
  if (key.length !== 32) throw new Error("TONI_MEMORY_KEY must decode to exactly 32 bytes.");
  return key;
}

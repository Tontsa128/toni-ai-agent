import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  sessionId?: string;
  userId?: string;
  startedAt: number;
}

export function createRequestContext(input: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: input.requestId ?? randomUUID(),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    startedAt: input.startedAt ?? Date.now()
  };
}

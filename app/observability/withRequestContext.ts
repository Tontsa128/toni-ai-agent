import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequestContext, type RequestContext } from "./RequestContext.js";
import { Logger } from "./Logger.js";
import { Metrics } from "./Metrics.js";
import { createErrorResponse } from "./ErrorResponse.js";

export async function withRequestContext(
  request: IncomingMessage, response: ServerResponse, logger: Logger, metrics: Metrics,
  handler: (context: RequestContext) => Promise<void>
): Promise<void> {
  const requested = typeof request.headers["x-request-id"] === "string" ? request.headers["x-request-id"] : undefined;
  const context = createRequestContext(requested && /^[A-Za-z0-9._:-]{1,128}$/.test(requested) ? { requestId: requested } : {});
  response.setHeader("x-request-id", context.requestId);
  metrics.requestStarted();
  const startedAt = Date.now();
  try {
    await handler(context);
    logger.info("Request completed.", { requestId:context.requestId, durationMs:Date.now()-startedAt });
  } catch (error: unknown) {
    metrics.requestFailed();
    const safeError = createErrorResponse(error, context.requestId);
    logger.error("Request failed.", {
      requestId:context.requestId, durationMs:Date.now()-startedAt,
      errorCode:safeError.body.code, errorMessage:safeError.body.error
    });
    if (!response.headersSent) {
      response.writeHead(safeError.statusCode, { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" });
      response.end(JSON.stringify(safeError.body));
    }
  }
}

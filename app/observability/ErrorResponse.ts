import { AgentError } from "../../agent/errors/AgentError.js";
export interface ErrorResponse { statusCode:number; body:{error:string;code:string;requestId:string}; }
export function createErrorResponse(error: unknown, requestId: string): ErrorResponse {
  if (error instanceof AgentError) {
    const statusCode = error.code === "APPROVAL_REQUIRED" ? 409 : error.code === "PERMISSION_DENIED" ? 403 :
      error.code === "TOOL_INPUT_INVALID" ? 400 : error.code === "APPROVAL_EXPIRED" ? 410 :
      error.code === "BUDGET_EXCEEDED" ? 429 : error.code === "CANCELLED" ? 499 : 500;
    return { statusCode, body: { error: error.message, code: error.code, requestId } };
  }
  return { statusCode:500, body:{error:"Internal server error.",code:"INTERNAL",requestId} };
}

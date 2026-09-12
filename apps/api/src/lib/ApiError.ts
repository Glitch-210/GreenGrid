import type { ErrorCode } from "@wattshare/shared";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: ErrorCode | string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(errorCode: ErrorCode | string, message: string, details?: Record<string, unknown>) {
    return new ApiError(400, errorCode, message, details);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(errorCode: ErrorCode | string, message: string, details?: Record<string, unknown>) {
    return new ApiError(409, errorCode, message, details);
  }
}

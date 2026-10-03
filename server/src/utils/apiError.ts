/**
 * Error type carrying an HTTP status and a stable machine-readable `code`.
 * The centralized `errorHandler` middleware already forwards `statusCode` and
 * `code` to the client, so services can throw these instead of leaking
 * internal cryptographic detail through generic 500s.
 *
 * `message` must always be safe to display to an end user. Raw WebAuthn
 * library errors (which can embed signature/attestation internals) are logged
 * server-side and replaced with a generic message before reaching a response.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors?: unknown[];

  constructor(statusCode: number, code: string, message: string, errors?: unknown[]) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(code: string, message: string): ApiError {
    return new ApiError(400, code, message);
  }

  static unauthorized(code: string, message: string): ApiError {
    return new ApiError(401, code, message);
  }

  static forbidden(code: string, message: string): ApiError {
    return new ApiError(403, code, message);
  }

  static notFound(code: string, message: string): ApiError {
    return new ApiError(404, code, message);
  }

  static conflict(code: string, message: string): ApiError {
    return new ApiError(409, code, message);
  }
}

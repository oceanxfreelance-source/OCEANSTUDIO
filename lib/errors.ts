/** Errors that are safe to show to the requester. Everything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Authentication required") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Forbidden") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new AppError(409, "CONFLICT", message);
export const gone = (message: string) => new AppError(410, "GONE", message);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new AppError(429, "RATE_LIMITED", "Too many requests. Please wait and try again.", { retryAfterSeconds });

/** Error raised by processing workers; carries a human message and a technical log. */
export class ProcessingError extends Error {
  constructor(
    public readonly humanMessage: string,
    public readonly technical?: string,
    public readonly retryable = true,
  ) {
    super(humanMessage);
    this.name = "ProcessingError";
  }
}

export class IntegrityError extends ProcessingError {
  constructor(message: string, technical?: string) {
    super(message, technical, false);
    this.name = "IntegrityError";
  }
}

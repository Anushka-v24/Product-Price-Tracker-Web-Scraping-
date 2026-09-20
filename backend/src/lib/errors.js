/**
 * Error types used across the app.
 *
 * HttpError      -> something the API should answer with a specific status code (404, 400, ...).
 * RetryableError -> a temporary problem (timeout, 429, 5xx). The caller should try again.
 * FatalError     -> retrying will not help (404 product, blocked, layout changed). Stop now.
 *
 * `code` is a short machine-readable reason that ends up in the check log (e.g. "STORE_5XX").
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class RetryableError extends Error {
  constructor(message, { code = 'TEMPORARY', retryAfterMs } = {}) {
    super(message);
    this.code = code;
    this.retryAfterMs = retryAfterMs;
    this.retryable = true;
  }
}

export class FatalError extends Error {
  constructor(message, { code = 'FATAL' } = {}) {
    super(message);
    this.code = code;
    this.retryable = false;
  }
}

/** An error that maps to an HTTP status; anything else becomes a 500. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Upstream provider (OpenAI, Tavily) failed or is not configured. */
export const upstreamError = (message: string) => new HttpError(502, message);
export const notConfigured = (name: string) => new HttpError(503, `${name} is not set in backend/.env`);

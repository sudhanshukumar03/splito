// A deliberate API failure: Hono's error handler turns it into { error: message }.
export class ApiError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 422 | 500,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

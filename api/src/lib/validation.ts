import type { HonoRequest } from 'hono'
import { ApiError } from './errors'

// Arrays and null are valid JSON but cannot supply the named fields our API expects.
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Compare the original decimal literal with the parsed integer without floating-point arithmetic.
// This also accepts exactly integral exponent forms such as 1.5e2 and 1000.0.
function isExactAmount(source: string, value: number): boolean {
  if (!Number.isSafeInteger(value) || value <= 0) return false
  const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(source)
  if (!match) return false
  const fraction = match[2] ?? ''
  const exponent = Number(match[3] ?? '0')
  if (!Number.isSafeInteger(exponent)) return false
  const digits = `${match[1]}${fraction}`.replace(/^0+/, '')
  const scale = exponent - fraction.length
  const expected = String(value)
  if (!Number.isSafeInteger(scale) || digits.length + scale !== expected.length) return false
  if (scale >= 0) return `${digits}${'0'.repeat(scale)}` === expected
  return digits.startsWith(expected) && /^0*$/.test(digits.slice(expected.length))
}

export async function readObject(request: HonoRequest): Promise<Record<string, unknown>> {
  // TypeScript types cannot validate incoming JSON. Narrow unknown before reading fields.
  let body: unknown
  try {
    body = JSON.parse(
      await request.text(),
      (key: string, value: unknown, context?: { source?: string }): unknown => {
        if (key !== 'totalCents' || typeof value !== 'number') return value
        // The native reviver supplies the original literal even if JSON parsing rounded its number.
        // Keep invalid amounts invalid so readTotal reports 422 rather than silently accepting them.
        return context?.source && isExactAmount(context.source, value) ? value : Number.NaN
      },
    )
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON')
  }
  if (!isObject(body)) throw new ApiError(400, 'Request body must be a JSON object')
  return body
}

export function readText(body: Record<string, unknown>, field: 'name' | 'title'): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, `${field} must be a nonempty string`)
  }
  return value.trim()
}

export function readTotal(body: Record<string, unknown>): number {
  // Reject strings, fractions, and unsafe integers instead of coercing or rounding money.
  const value = body.totalCents
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new ApiError(422, 'totalCents must be a positive safe integer')
  }
  return value
}

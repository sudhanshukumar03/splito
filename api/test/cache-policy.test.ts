import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('financial response cache policy', () => {
  it.each([
    ['health', '/api/health', undefined, 200],
    ['missing resource', '/api/homes/missing', undefined, 404],
    ['invalid write', '/api/homes', { method: 'POST', body: '{}' }, 400],
  ])('does not cache %s responses', async (_label, path, init, status) => {
    const response = await exports.default.fetch(new Request(`http://localhost${path}`, init))
    expect(response.status).toBe(status)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})

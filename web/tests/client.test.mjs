import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, api } from '../src/lib/api.ts'
import { money, parseAmount } from '../src/lib/money.ts'
import { forgetPayment, paymentKey } from '../src/lib/payment-attempts.ts'
import { recentHomes, rememberHome } from '../src/lib/storage.ts'

const unpaid = { id: 'share-1', memberId: 'member-1', amountCents: 101, paidAt: null }
const paid = { ...unpaid, paidAt: '2026-11-03T00:00:00.000Z' }
const bill = {
  id: 'bill-1',
  homeId: 'home-1',
  title: 'Internet',
  totalCents: 101,
  shares: [unpaid],
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function storage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  }
}
function stubStorage(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { value, configurable: true })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original)
    else Reflect.deleteProperty(globalThis, name)
  })
}

for (const [input, expected] of [
  ['0.01', 1],
  ['.50', 50],
  ['1.', 100],
  ['1.5', 150],
  ['86.43', 8643],
  [' 001.01 ', 101],
  ['90071992547409.91', Number.MAX_SAFE_INTEGER],
]) {
  test(`money input ${input} preserves exact cents`, () =>
    assert.equal(parseAmount(input), expected))
}
for (const input of [
  '',
  '0',
  '-1',
  '1.001',
  '1e2',
  'Infinity',
  'NaN',
  '12,34',
  '90071992547409.92',
  '.',
]) {
  test(`money input ${JSON.stringify(input)} is rejected without rounding`, () =>
    assert.throws(() => parseAmount(input)))
}
test('household totals remain exact beyond Number.MAX_SAFE_INTEGER', () => {
  assert.equal(money(BigInt(Number.MAX_SAFE_INTEGER) * 100n + 1n), '$9,007,199,254,740,991.01')
  assert.equal(money(0), '$0.00')
})
test('valid bill data preserves zero-cent unpaid shares', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    json({
      bills: [
        {
          ...bill,
          shares: [unpaid, { ...unpaid, id: 'zero', memberId: 'member-2', amountCents: 0 }],
        },
      ],
    }),
  )
  const response = await api.bills('home-1')
  assert.equal(response.bills[0].shares[1].amountCents, 0)
  assert.equal(response.bills[0].shares[1].paidAt, null)
})
test('a successful response with incorrect share sums is rejected', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json({ bills: [{ ...bill, totalCents: 102 }] }))
  await assert.rejects(api.bills('home-1'), /incomplete data/)
})
test('a 500 payment response rejects instead of producing a paid share', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    json({ error: 'Internal server error' }, 500),
  )
  await assert.rejects(
    api.pay('bill-1', 'share-1', 'attempt-1'),
    (error) => error instanceof ApiError && error.status === 500 && error.uncertain,
  )
  assert.equal(fetchMock.mock.callCount(), 1, 'No automatic retry of a write')
})
test('an unpaid successful payment payload is rejected', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(unpaid))
  await assert.rejects(api.pay('bill-1', 'share-1', 'attempt-1'), /incomplete data/)
})
test('HTML error responses produce a recoverable API error', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('<h1>Bad gateway</h1>', { status: 502 }),
  )
  await assert.rejects(api.home('home-1'), /unreadable response/)
})
test('a slow request times out and aborts its underlying fetch', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signal
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    signal = options.signal
    return new Promise((_resolve, reject) =>
      options.signal.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      ),
    )
  })
  const result = api.pay('bill-1', 'share-1', 'attempt-1')
  const rejection = assert.rejects(
    result,
    (error) => error instanceof ApiError && error.uncertain && /too long/.test(error.message),
  )
  t.mock.timers.tick(15_000)
  await rejection
  assert.equal(signal.aborted, true)
})
test('lost payment responses reuse the same key and return a confirmed timestamp', async (t) => {
  stubStorage(t, 'sessionStorage', storage())
  const keys = []
  let attempts = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    keys.push(options.headers['Idempotency-Key'])
    if (++attempts === 1) throw new TypeError('Connection lost after commit')
    return json(paid)
  })
  await assert.rejects(api.pay('bill-1', 'share-1', paymentKey('retry-home', 'bill-1', 'share-1')))
  const result = await api.pay('bill-1', 'share-1', paymentKey('retry-home', 'bill-1', 'share-1'))
  assert.equal(result.paidAt, paid.paidAt)
  assert.equal(keys[0], keys[1])
  forgetPayment('retry-home', 'bill-1', 'share-1')
  assert.notEqual(paymentKey('retry-home', 'bill-1', 'share-1'), keys[0])
})
test('a same-tab stored attempt is reused after reload', (t) => {
  const saved = storage()
  saved.setItem('splito-payment:reload-home:bill-1:share-1', 'original-attempt')
  stubStorage(t, 'sessionStorage', saved)
  assert.equal(paymentKey('reload-home', 'bill-1', 'share-1'), 'original-attempt')
})
test('blocked session storage keeps a consistent in-memory retry key', (t) => {
  stubStorage(t, 'sessionStorage', {
    getItem() {
      throw new Error('Denied')
    },
    setItem() {
      throw new Error('Denied')
    },
    removeItem() {
      throw new Error('Denied')
    },
  })
  const key = paymentKey('private-home', 'bill-1', 'share-1')
  assert.equal(paymentKey('private-home', 'bill-1', 'share-1'), key)
  assert.doesNotThrow(() => forgetPayment('private-home', 'bill-1', 'share-1'))
})
test('a payment conflict preserves its actionable 409 status', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json({ error: 'Share already paid' }, 409))
  await assert.rejects(
    api.pay('bill-1', 'share-1', 'new-key'),
    (error) => error.status === 409 && !error.uncertain,
  )
})
test('canceling an obsolete read aborts its request', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    (_url, options) =>
      new Promise((_resolve, reject) =>
        options.signal.addEventListener('abort', () => reject(new Error('Aborted'))),
      ),
  )
  const controller = new AbortController()
  const result = api.home('home-1', controller.signal)
  const rejection = assert.rejects(result, ApiError)
  controller.abort()
  await rejection
})
test('ambiguous bill creation is surfaced without an automatic duplicate write', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Network lost')
  })
  await assert.rejects(api.addBill('home-1', 'Internet', 101), (error) => error.uncertain)
  assert.equal(fetchMock.mock.callCount(), 1)
})
test('recent homes tolerate corrupt storage and deduplicate by ID', (t) => {
  const saved = storage()
  stubStorage(t, 'localStorage', saved)
  saved.setItem('splito-homes', 'invalid json')
  assert.deepEqual(recentHomes(), [])
  rememberHome({ id: 'a', name: 'Old name' })
  rememberHome({ id: 'a', name: 'New name' })
  assert.deepEqual(recentHomes(), [{ id: 'a', name: 'New name' }])
})

for (const timestamp of ['', 'not-a-date']) {
  test(`invalid paid timestamp ${JSON.stringify(timestamp)} cannot confirm a payment`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => json({ ...paid, paidAt: timestamp }))
    await assert.rejects(api.pay('bill-1', 'share-1', 'attempt-1'), /incomplete data/)
  })
}
test('a corrupt blank stored key is replaced before a payment attempt', (t) => {
  const saved = storage()
  saved.setItem('splito-payment:blank-home:bill-1:share-1', '   ')
  stubStorage(t, 'sessionStorage', saved)
  assert.notEqual(paymentKey('blank-home', 'bill-1', 'share-1').trim(), '')
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api } from '../src/lib/api.ts'
import { CreationAttempt } from '../src/lib/creation-attempt.ts'

test('POST 201 followed by GET 500 retries the read without creating a second bill', async (t) => {
  const attempt = new CreationAttempt()
  const bill = {
    id: 'bill',
    homeId: 'home',
    title: 'Internet',
    totalCents: 100,
    shares: [{ id: 'share', memberId: 'member', amountCents: 100, paidAt: null }],
  }
  const methods = []
  let reads = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    methods.push(options.method ?? 'GET')
    if (options.method === 'POST') return new Response(JSON.stringify(bill), { status: 201 })
    if (++reads === 1) return new Response('{"error":"Temporary failure"}', { status: 500 })
    return new Response(JSON.stringify({ bills: [bill] }))
  })
  const create = () => api.addBill('home', 'Internet', 100)
  const refresh = async () => {
    try {
      await api.bills('home')
      return true
    } catch {
      return false
    }
  }
  assert.equal(await attempt.run(create, refresh), false)
  assert.equal(attempt.committed, true)
  assert.equal(await attempt.run(create, refresh), true)
  assert.deepEqual(methods, ['POST', 'GET', 'GET'])
})

test('a pending creation cannot issue a second concurrent write', async () => {
  const attempt = new CreationAttempt()
  let finish
  let writes = 0
  const create = () => {
    writes++
    return new Promise((resolve) => {
      finish = resolve
    })
  }
  const first = attempt.run(create, async () => true)
  assert.equal(await attempt.run(create, async () => true), false)
  assert.equal(writes, 1)
  finish()
  assert.equal(await first, true)
})

test('a rejected creation is not reported as committed', async () => {
  const attempt = new CreationAttempt()
  let reads = 0
  await assert.rejects(
    attempt.run(
      async () => {
        throw new Error('Invalid input')
      },
      async () => {
        reads++
        return true
      },
    ),
  )
  assert.equal(attempt.committed, false)
  assert.equal(reads, 0)
  assert.equal(
    await attempt.run(
      async () => {},
      async () => true,
    ),
    true,
  )
})

test('a thrown refresh retains the confirmed write for a read-only retry', async () => {
  const attempt = new CreationAttempt()
  let writes = 0
  const create = async () => {
    writes++
  }
  await assert.rejects(
    attempt.run(create, async () => {
      throw new Error('Read failed')
    }),
  )
  assert.equal(attempt.committed, true)
  assert.equal(await attempt.run(create, async () => true), true)
  assert.equal(writes, 1)
})

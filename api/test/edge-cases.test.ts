import { env, exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { Home } from '../src/types'
import {
  type Balance,
  type Bill,
  call,
  createBill,
  createHome,
  type Member,
  type Share,
} from './helpers'

function firstShare(bill: Bill): Share {
  const share = bill.shares[0]
  if (!share) throw new Error('Expected a share')
  return share
}

function pay(billId: string, shareId: string, key: string) {
  return call<Share>('POST', `/api/bills/${billId}/shares/${shareId}/pay`, {
    headers: { 'Idempotency-Key': key },
  })
}

describe('JSON input and error responses', () => {
  it('preserves health and returns JSON for an unknown route', async () => {
    expect(await call('GET', '/api/health')).toEqual({ status: 200, body: { status: 'ok' } })
    expect(await call('GET', '/api/missing')).toEqual({
      status: 404,
      body: { error: 'Route not found' },
    })
  })

  it.each([null, [], {}, { name: 123 }, { name: '   ' }])(
    'rejects invalid home input %j',
    async (body) => {
      const result = await call('POST', '/api/homes', { body })
      expect(result.status).toBe(400)
      expect(result.body).toEqual({ error: expect.any(String) })
    },
  )

  it('rejects malformed JSON without writing a home', async () => {
    const before = await env.DB.prepare('SELECT count(*) AS count FROM homes').first<{
      count: number
    }>()
    const response = await exports.default.fetch(
      new Request('http://localhost/api/homes', {
        method: 'POST',
        body: '{',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.any(String) })
    const after = await env.DB.prepare('SELECT count(*) AS count FROM homes').first<{
      count: number
    }>()
    expect(after).toEqual(before)
  })

  it.each([true, undefined, Number.MAX_SAFE_INTEGER + 1])(
    'rejects additional invalid totals %j',
    async (totalCents) => {
      const { homeId } = await createHome(['Asha'])
      const result = await call('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Rent', totalCents },
      })
      expect(result.status).toBe(422)
      const listed = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
      expect(listed.body.bills).toEqual([])
    },
  )
})

describe('membership, small amounts, and supporting reads', () => {
  it('keeps zero-cent shares and does not redistribute old bills to new members', async () => {
    const { homeId, members } = await createHome(['Same name', 'Same name', 'Third'])
    const created = await createBill(homeId, 1)
    expect(created.status).toBe(201)
    expect(created.body.shares.map((share) => share.amountCents)).toEqual([1, 0, 0])
    await call('POST', `/api/homes/${homeId}/members`, { body: { name: 'Later' } })
    const home = await call<Home & { members: Member[] }>('GET', `/api/homes/${homeId}`)
    expect(home.body.members.map((member) => member.name)).toEqual([
      'Same name',
      'Same name',
      'Third',
      'Later',
    ])
    const listed = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(listed.body.bills).toEqual([created.body])
    expect(listed.body.bills[0]?.shares.map((share) => share.memberId)).toEqual(
      members.map((member) => member.id),
    )
    const zeroShare = created.body.shares[1]
    if (!zeroShare) throw new Error('Expected a zero share')
    expect((await pay(created.body.id, zeroShare.id, crypto.randomUUID())).status).toBe(200)
  })

  it('uses actual database insertion order when members are added concurrently', async () => {
    const { homeId } = await createHome([])
    const added = await Promise.all(
      ['A', 'B', 'C', 'D'].map((name) =>
        call('POST', `/api/homes/${homeId}/members`, { body: { name } }),
      ),
    )
    expect(added.every((result) => result.status === 201)).toBe(true)
    const home = await call<Home & { members: Member[] }>('GET', `/api/homes/${homeId}`)
    const bill = await createBill(homeId, 5)
    expect(bill.body.shares.map((share) => share.memberId)).toEqual(
      home.body.members.map((member) => member.id),
    )
    expect(bill.body.shares.map((share) => share.amountCents)).toEqual([2, 1, 1, 1])
  })

  it('returns empty lists for an empty home and zero balances for members without bills', async () => {
    const empty = await createHome([])
    expect((await call('GET', `/api/homes/${empty.homeId}/balances`)).body).toEqual({
      balances: [],
    })
    expect((await call('GET', `/api/homes/${empty.homeId}/bills`)).body).toEqual({ bills: [] })
    const { homeId, members } = await createHome(['Asha', 'Ben'])
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances).toEqual(
      members.map((member) => ({ memberId: member.id, name: member.name, outstandingCents: 0 })),
    )
    expect((await call('GET', '/api/homes/missing')).status).toBe(404)
    expect((await call('GET', '/api/homes/missing/bills')).status).toBe(404)
  })
})

describe('payment races and resource boundaries', () => {
  it('lets exactly one of several different-key requests record payment', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const { body: bill } = await createBill(homeId, 1001)
    const share = firstShare(bill)
    const keys = Array.from({ length: 8 }, () => crypto.randomUUID())
    const results = await Promise.all(keys.map((key) => pay(bill.id, share.id, key)))
    expect(results.filter((result) => result.status === 200)).toHaveLength(1)
    expect(results.filter((result) => result.status === 409)).toHaveLength(7)
    const winningIndex = results.findIndex((result) => result.status === 200)
    const winningKey = keys[winningIndex]
    if (!winningKey) throw new Error('Expected one winning key')
    expect(await pay(bill.id, share.id, winningKey)).toEqual(results[winningIndex])
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances.map((balance) => balance.outstandingCents)).toEqual([0, 500])
  })

  it('returns an identical result for concurrent same-key attempts', async () => {
    const { homeId } = await createHome(['Asha'])
    const { body: bill } = await createBill(homeId, 50)
    const share = firstShare(bill)
    const key = crypto.randomUUID()
    const results = await Promise.all(Array.from({ length: 4 }, () => pay(bill.id, share.id, key)))
    expect(results.every((result) => result.status === 200)).toBe(true)
    for (const result of results) expect(result).toEqual(results[0])
    expect(results[0]?.body).toEqual({ ...share, paidAt: expect.any(String) })
  })

  it('scopes keys to a share and prevents paying through a different bill path', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const { body: bill } = await createBill(homeId, 100)
    const { body: other } = await createBill(homeId, 200)
    const share = firstShare(bill)
    const key = crypto.randomUUID()
    expect((await pay(other.id, share.id, key)).status).toBe(404)
    expect((await pay(bill.id, share.id, '   ')).status).toBe(400)
    const paid = await Promise.all(bill.shares.map((item) => pay(bill.id, item.id, key)))
    expect(paid.every((result) => result.status === 200)).toBe(true)
    const listed = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(listed.body.bills[0]?.shares.every((item) => item.paidAt !== null)).toBe(true)
    expect(listed.body.bills[1]?.shares.every((item) => item.paidAt === null)).toBe(true)
  })
})

describe('database protection and numeric limits', () => {
  it('rejects cross-home shares, duplicate shares, and partial payment state', async () => {
    const { homeId } = await createHome(['Asha'])
    const { body: bill } = await createBill(homeId, 100)
    const other = await createHome(['Other'])
    const foreignMember = other.members[0]
    if (!foreignMember) throw new Error('Expected a foreign member')
    await expect(
      env.DB.prepare(
        'INSERT INTO shares (id, home_id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(crypto.randomUUID(), homeId, bill.id, foreignMember.id, 100)
        .run(),
    ).rejects.toThrow()
    const share = firstShare(bill)
    await expect(
      env.DB.prepare(
        'INSERT INTO shares (id, home_id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(crypto.randomUUID(), homeId, bill.id, share.memberId, 100)
        .run(),
    ).rejects.toThrow()
    await expect(
      env.DB.prepare('UPDATE shares SET paid_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), share.id)
        .run(),
    ).rejects.toThrow()
  })

  it('rejects invalid bill amounts directly in the database', async () => {
    const { homeId } = await createHome(['Asha'])
    for (const total of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(
        env.DB.prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
          .bind(crypto.randomUUID(), homeId, 'Invalid', total)
          .run(),
      ).rejects.toThrow()
    }
  })

  it('rolls back a bill and preceding shares when a later share insert fails', async () => {
    const { homeId } = await createHome(['Asha', 'Ben', 'Chitra'])
    await env.DB.prepare(`CREATE TRIGGER reject_rollback_share BEFORE INSERT ON shares
      WHEN NEW.amount_cents = 333
      BEGIN SELECT RAISE(ABORT, 'Simulated failed share insert'); END`).run()
    try {
      const result = await createBill(homeId, 1000)
      expect(result).toEqual({ status: 500, body: { error: 'Internal server error' } })
      const bills = await env.DB.prepare('SELECT id FROM bills WHERE home_id = ?')
        .bind(homeId)
        .all()
      const shares = await env.DB.prepare('SELECT id FROM shares WHERE home_id = ?')
        .bind(homeId)
        .all()
      expect(bills.results).toEqual([])
      expect(shares.results).toEqual([])
    } finally {
      await env.DB.exec('DROP TRIGGER reject_rollback_share')
    }
  })

  it('rejects an overflowing balance and returns an exact balance after payment', async () => {
    const { homeId } = await createHome(['Asha'])
    const { body: bill } = await createBill(homeId, Number.MAX_SAFE_INTEGER)
    expect(firstShare(bill).amountCents).toBe(Number.MAX_SAFE_INTEGER)
    await createBill(homeId, 1)
    expect(await call('GET', `/api/homes/${homeId}/balances`)).toEqual({
      status: 500,
      body: { error: 'Balance exceeds supported numeric range' },
    })
    await pay(bill.id, firstShare(bill).id, crypto.randomUUID())
    const result = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(result.body.balances[0]?.outstandingCents).toBe(1)
  })
})

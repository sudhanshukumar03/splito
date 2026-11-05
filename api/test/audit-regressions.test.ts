import { env, exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { insertBill, insertMember, listBills, listMembers, payShare } from '../src/db/queries'
import { splitCents } from '../src/domain/split'
import { type Balance, type Bill, call, createBill, createHome, type Share } from './helpers'

async function rawBill(homeId: string, body: string) {
  return exports.default.fetch(
    new Request(`http://localhost/api/homes/${homeId}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }),
  )
}

function firstShare(bill: Bill): Share {
  const share = bill.shares[0]
  if (!share) throw new Error('Expected a share')
  return share
}

// Run real D1 SQL, then force a concurrent write immediately after a selected read.
function afterRead(match: RegExp, action: () => Promise<void>): D1Database {
  let fired = false
  return new Proxy(env.DB, {
    get(target, property) {
      if (property !== 'prepare') return Reflect.get(target, property, target)
      return (sql: string) => {
        const statement = target.prepare(sql)
        if (!match.test(sql)) return statement
        return {
          bind(...values: unknown[]) {
            const bound = statement.bind(...values)
            return {
              async all() {
                const result = await bound.all()
                if (!fired) {
                  fired = true
                  await action()
                }
                return result
              },
            }
          },
        }
      }
    },
  })
}

describe('exact numeric input', () => {
  it('matches exact BigInt arithmetic at the supported splitting boundaries', () => {
    for (let count = 1; count <= 64; count += 1) {
      for (const total of [
        1,
        2,
        3,
        7,
        1000,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER - 1,
      ]) {
        const exactTotal = BigInt(total)
        const divisor = BigInt(count)
        const expected = Array.from(
          { length: count },
          (_, index) => exactTotal / divisor + (BigInt(index) < exactTotal % divisor ? 1n : 0n),
        )
        expect(splitCents(total, count).map(BigInt)).toEqual(expected)
      }
    }
  })

  it.each([
    '9007199254740990.5',
    '9007199254740991.1',
    '0.99999999999999999999',
    '10.000000000000000001',
    '1.0000000000000001',
    '1e10000',
    '1e-10000',
    '-0',
    '"100"',
    'true',
    '{"value":100,"source":"100"}',
  ])('rejects the original invalid numeric input %s without creating a bill', async (literal) => {
    const { homeId } = await createHome(['Asha'])
    const response = await rawBill(homeId, `{"title":"Precision","totalCents":${literal}}`)
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: expect.any(String) })
    expect((await call('GET', `/api/homes/${homeId}/bills`)).body).toEqual({ bills: [] })
  })

  it.each([
    ['1', 1],
    ['1000.0', 1000],
    ['1e3', 1000],
    ['1.5e2', 150],
    ['0.1e1', 1],
    ['100000000000000000000e-20', 1],
    ['9007199254740991.0000000000', Number.MAX_SAFE_INTEGER],
    ['1.0000000000000000', 1],
    ['10e-1', 1],
    ['1e+03', 1000],
  ] as const)('accepts an exactly integral JSON number %s', async (literal, expected) => {
    const { homeId } = await createHome(['Asha'])
    const response = await rawBill(homeId, `{"title":"Exact","totalCents":${literal}}`)
    expect(response.status).toBe(201)
    const bill = (await response.json()) as Bill
    expect(bill.totalCents).toBe(expected)
    expect(firstShare(bill).amountCents).toBe(expected)
  })

  it('validates the last decoded property when JSON keys are duplicated or escaped', async () => {
    const { homeId } = await createHome(['Asha'])
    const rejected = await rawBill(
      homeId,
      '{"title":"Duplicate","totalCents":100,"\\u0074otalCents":9007199254740990.5}',
    )
    expect(rejected.status).toBe(422)
    const accepted = await rawBill(
      homeId,
      '{"title":"Duplicate","totalCents":9007199254740990.5,"\\u0074otalCents":1e3}',
    )
    expect(accepted.status).toBe(201)
    expect(await accepted.json()).toMatchObject({ totalCents: 1000 })
  })

  it('does not mistake nested fields or string contents for the top-level amount', async () => {
    const { homeId } = await createHome(['Asha'])
    const response = await rawBill(
      homeId,
      '{"title":"Mention totalCents: 9007199254740990.5","metadata":{"totalCents":0.99999999999999999999},"totalCents":100}',
    )
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ totalCents: 100 })
  })
})

describe('consistent reads and concurrent writes', () => {
  it('does not combine old bill headers with share payments from a later database state', async () => {
    const { homeId } = await createHome(['Asha'])
    const { body: original } = await createBill(homeId, 100)
    let intercepted = false
    const db = afterRead(/FROM bills\b/, async () => {
      intercepted = true
      await insertBill(env.DB, homeId, 'Newer bill', 200)
      await payShare(env.DB, original.id, firstShare(original).id, crypto.randomUUID())
    })
    const snapshot = await listBills(db, homeId)
    expect(intercepted).toBe(true)
    expect(snapshot.map((bill) => bill.id)).toEqual([original.id])
    expect(snapshot[0]?.shares[0]?.paidAt).toBeNull()
    const latest = await listBills(env.DB, homeId)
    expect(latest).toHaveLength(2)
    expect(latest[0]?.shares[0]?.paidAt).not.toBeNull()
  })

  it('uses the captured membership if another member joins before the bill write', async () => {
    const { homeId, members } = await createHome(['Asha', 'Ben'])
    let intercepted = false
    const db = afterRead(/FROM members WHERE home_id/, async () => {
      intercepted = true
      await insertMember(env.DB, homeId, 'Later member')
    })
    const bill = await insertBill(db, homeId, 'Snapshot', 101)
    expect(intercepted).toBe(true)
    expect(bill.shares.map((share) => share.memberId)).toEqual(members.map((member) => member.id))
    expect(bill.shares.map((share) => share.amountCents)).toEqual([51, 50])
    expect(await listMembers(env.DB, homeId)).toHaveLength(3)
    expect((await insertBill(env.DB, homeId, 'Next bill', 101)).shares).toHaveLength(3)
  })

  it('creates several concurrent bills without losing shares or balance amounts', async () => {
    const { homeId, members } = await createHome(['Asha', 'Ben', 'Chitra'])
    const totals = [1, 2, 1000, 1001, 3000]
    const created = await Promise.all(totals.map((total) => createBill(homeId, total)))
    expect(created.every((result) => result.status === 201)).toBe(true)
    expect(new Set(created.map((result) => result.body.id)).size).toBe(totals.length)
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances).toEqual(
      members.map((member) => ({
        memberId: member.id,
        name: member.name,
        outstandingCents: created.reduce(
          (sum, result) =>
            sum +
            (result.body.shares.find((share) => share.memberId === member.id)?.amountCents ?? 0),
          0,
        ),
      })),
    )
    expect(await listBills(env.DB, homeId)).toHaveLength(totals.length)
  })

  it('keeps bills and balances isolated between homes with matching member names', async () => {
    const first = await createHome(['Asha'])
    const second = await createHome(['Asha'])
    const { body: firstBill } = await createBill(first.homeId, 100)
    const { body: secondBill } = await createBill(second.homeId, 900)
    await payShare(env.DB, firstBill.id, firstShare(firstBill).id, crypto.randomUUID())
    expect(await listBills(env.DB, first.homeId)).toHaveLength(1)
    const secondBills = await listBills(env.DB, second.homeId)
    expect(secondBills.map((bill) => bill.id)).toEqual([secondBill.id])
    expect(firstShare(secondBills[0] ?? secondBill).paidAt).toBeNull()
    const balances = await call<{ balances: Balance[] }>(
      'GET',
      `/api/homes/${second.homeId}/balances`,
    )
    expect(balances.body.balances[0]?.outstandingCents).toBe(900)
  })
})

describe('unexpected stored bill inconsistencies', () => {
  it('reports missing shares instead of returning a misleading empty share list', async () => {
    const { homeId } = await createHome(['Asha'])
    const { body: bill } = await createBill(homeId, 100)
    await env.DB.prepare('DELETE FROM shares WHERE bill_id = ?').bind(bill.id).run()
    const response = await call('GET', `/api/homes/${homeId}/bills`)
    expect(response).toEqual({ status: 500, body: { error: 'Internal server error' } })
  })

  it('reports a share sum that differs from its bill total', async () => {
    const { homeId } = await createHome(['Asha'])
    const { body: bill } = await createBill(homeId, 100)
    await env.DB.prepare('UPDATE shares SET amount_cents = 101 WHERE id = ?')
      .bind(firstShare(bill).id)
      .run()
    const response = await call('GET', `/api/homes/${homeId}/bills`)
    expect(response).toEqual({ status: 500, body: { error: 'Internal server error' } })
  })
})

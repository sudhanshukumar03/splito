import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarizeLedger } from '../src/lib/ledger.ts'

test('shared page summaries preserve newcomer balances and explicit zero-cent unpaid shares', () => {
  const members = ['a', 'b', 'c'].map((id) => ({ id, homeId: 'home', name: id }))
  const bills = [
    {
      id: 'bill',
      homeId: 'home',
      title: 'Tiny bill',
      totalCents: 1,
      shares: [
        { id: 's1', memberId: 'a', amountCents: 1, paidAt: '2026-11-04T00:00:00.000Z' },
        { id: 's2', memberId: 'b', amountCents: 0, paidAt: null },
      ],
    },
  ]
  const original = structuredClone(bills)
  const result = summarizeLedger(members, bills)
  assert.equal(result.outstandingCents, 0n)
  assert.equal(result.paidShares, 1)
  assert.equal(result.totalShares, 2)
  assert.equal(result.settledBills, 0, 'An unpaid zero-cent share keeps the bill open')
  assert.deepEqual(
    result.members.map((item) => [
      item.member.id,
      item.unpaidShares,
      item.totalShares,
      item.outstandingCents,
    ]),
    [
      ['a', 0, 1, 0n],
      ['b', 1, 1, 0n],
      ['c', 0, 0, 0n],
    ],
  )
  assert.deepEqual(bills, original, 'Deriving figures must not rewrite persisted shares')
})
test('overview and member totals remain exact when accumulated bills exceed the safe-number range', () => {
  const amount = Number.MAX_SAFE_INTEGER
  const members = [{ id: 'a', homeId: 'home', name: 'Asha' }]
  const bills = [1, 2].map((index) => ({
    id: `bill-${index}`,
    homeId: 'home',
    title: 'Large bill',
    totalCents: amount,
    shares: [{ id: `s-${index}`, memberId: 'a', amountCents: amount, paidAt: null }],
  }))
  const result = summarizeLedger(members, bills)
  assert.equal(result.totalCents, 18014398509481982n)
  assert.equal(result.outstandingCents, 18014398509481982n)
  assert.equal(result.members[0].outstandingCents, result.outstandingCents)
})
test('an unknown share member cannot silently disappear from page balances', () => {
  const bills = [
    {
      id: 'bill',
      homeId: 'home',
      title: 'Bill',
      totalCents: 1,
      shares: [{ id: 'share', memberId: 'missing', amountCents: 1, paidAt: null }],
    },
  ]
  assert.throws(() => summarizeLedger([], bills), /unknown household member/)
})

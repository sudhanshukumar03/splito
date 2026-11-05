import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, api } from '../src/lib/api.ts'
import { paymentKey } from '../src/lib/payment-attempts.ts'
import { recentHomes } from '../src/lib/storage.ts'

const member = { id: 'member-1', homeId: 'home-1', name: 'Asha' }
const share = { id: 'share-1', memberId: member.id, amountCents: 101, paidAt: null }
const bill = { id: 'bill-1', homeId: 'home-1', title: 'Internet', totalCents: 101, shares: [share] }
const home = { id: 'home-1', name: 'Home', members: [member] }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })

for (const [label, response, read] of [
  ['blank home ID', { ...home, id: ' ' }, () => api.home('home-1')],
  ['blank member name', { ...home, members: [{ ...member, name: ' ' }] }, () => api.home('home-1')],
  ['duplicate members', { ...home, members: [member, member] }, () => api.home('home-1')],
  [
    'cross-home member',
    { ...home, members: [{ ...member, homeId: 'other' }] },
    () => api.home('home-1'),
  ],
  ['wrong home', { ...home, id: 'other' }, () => api.home('home-1')],
  ['duplicate bills', { bills: [bill, bill] }, () => api.bills('home-1')],
  ['cross-home bill', { bills: [{ ...bill, homeId: 'other' }] }, () => api.bills('home-1')],
  [
    'duplicate share IDs',
    { bills: [{ ...bill, totalCents: 202, shares: [share, { ...share, memberId: 'member-2' }] }] },
    () => api.bills('home-1'),
  ],
  [
    'duplicate member shares',
    { bills: [{ ...bill, totalCents: 202, shares: [share, { ...share, id: 'share-2' }] }] },
    () => api.bills('home-1'),
  ],
  [
    'share reused across bills',
    { bills: [bill, { ...bill, id: 'bill-2' }] },
    () => api.bills('home-1'),
  ],
]) {
  test(`rejects ${label} before ledger rendering`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => json(response))
    await assert.rejects(
      read(),
      (error) => error instanceof ApiError && /incomplete data/.test(error.message),
    )
  })
}

for (const [label, response, write] of [
  ['wrong created home name', { id: 'new', name: 'Other' }, () => api.createHome('Home')],
  ['wrong member home', { ...member, homeId: 'other' }, () => api.addMember('home-1', 'Asha')],
  ['wrong member name', { ...member, name: 'Other' }, () => api.addMember('home-1', 'Asha')],
  [
    'wrong bill amount',
    { ...bill, totalCents: 102, shares: [{ ...share, amountCents: 102 }] },
    () => api.addBill('home-1', 'Internet', 101),
  ],
  ['wrong bill title', { ...bill, title: 'Other' }, () => api.addBill('home-1', 'Internet', 101)],
  [
    'wrong payment share',
    { ...share, id: 'other', paidAt: '2026-11-04T00:00:00.000Z' },
    () => api.pay('bill-1', 'share-1', 'key'),
  ],
]) {
  test(`${label} cannot falsely confirm a write`, async (t) => {
    const mock = t.mock.method(globalThis, 'fetch', async () => json(response))
    await assert.rejects(write(), (error) => error instanceof ApiError && error.uncertain)
    assert.equal(mock.mock.callCount(), 1)
  })
}

test('financial reads explicitly bypass browser cache', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => json(home))
  await api.home('home-1')
  assert.equal(mock.mock.calls[0].arguments[1].cache, 'no-store')
})

function setStorage(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, value })
  t.after(() =>
    previous
      ? Object.defineProperty(globalThis, name, previous)
      : Reflect.deleteProperty(globalThis, name),
  )
}
for (const [index, corrupt] of [
  'key\ninvalid',
  'key\rinvalid',
  'key\0invalid',
  '\u{1f4b3}',
].entries()) {
  test(`corrupt stored payment key ${index} is replaced with a usable retry key`, (t) => {
    setStorage(t, 'sessionStorage', { getItem: () => corrupt, setItem() {} })
    const key = paymentKey(`corrupt-${index}`, 'bill', 'share')
    assert.notEqual(key, corrupt)
    assert.doesNotThrow(() => new Headers({ 'Idempotency-Key': key }))
    assert.equal(paymentKey(`corrupt-${index}`, 'bill', 'share'), key)
  })
}
test('recent-home recovery removes empty entries and repeated IDs', (t) => {
  setStorage(t, 'localStorage', {
    getItem: () =>
      JSON.stringify([
        { id: ' ', name: 'Empty ID' },
        { id: 'empty-name', name: ' ' },
        { id: 'home-1', name: 'Current name' },
        { id: 'home-1', name: 'Old name' },
        { id: 'home-2', name: 'Other home' },
      ]),
  })
  assert.deepEqual(recentHomes(), [
    { id: 'home-1', name: 'Current name' },
    { id: 'home-2', name: 'Other home' },
  ])
})

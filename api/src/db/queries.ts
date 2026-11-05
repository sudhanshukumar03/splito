import { splitCents } from '../domain/split'
import { ApiError } from '../lib/errors'
import type { Balance, Bill, Home, Member, PaidShare, Share } from '../types'

// Bind values to prepared statements so user input is treated as data, not SQL.
export async function requireHome(db: D1Database, homeId: string): Promise<Home> {
  const home = await db
    .prepare('SELECT id, name FROM homes WHERE id = ?')
    .bind(homeId)
    .first<Home>()
  if (!home) throw new ApiError(404, 'Home not found')
  return home
}

export async function insertHome(db: D1Database, name: string): Promise<Home> {
  const home = { id: crypto.randomUUID(), name }
  await db.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(home.id, name).run()
  return home
}

export async function insertMember(db: D1Database, homeId: string, name: string): Promise<Member> {
  await requireHome(db, homeId)
  const member = { id: crypto.randomUUID(), homeId, name }
  // SQLite assigns ordinal during insertion; concurrent additions do not allocate positions in JS.
  await db
    .prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
    .bind(member.id, homeId, name)
    .run()
  return member
}

// Always sort explicitly: insertion order determines who receives remainder cents.
export async function listMembers(db: D1Database, homeId: string): Promise<Member[]> {
  const result = await db
    .prepare('SELECT id, home_id AS homeId, name FROM members WHERE home_id = ? ORDER BY ordinal')
    .bind(homeId)
    .all<Member>()
  return result.results
}

export async function insertBill(
  db: D1Database,
  homeId: string,
  title: string,
  totalCents: number,
): Promise<Bill> {
  await requireHome(db, homeId)
  // Capture membership once. Members added after this read do not receive shares of this bill.
  // The read precedes the write transaction; the stored shares preserve its snapshot.
  const members = await listMembers(db, homeId)
  if (members.length === 0) throw new ApiError(422, 'Home has no members')
  const amounts = splitCents(totalCents, members.length)
  const shares = members.map((member, index): Share => {
    const amountCents = amounts[index]
    // Zero is a valid share when the bill total is smaller than the member count.
    if (amountCents === undefined) throw new Error('Missing calculated share')
    return { id: crypto.randomUUID(), memberId: member.id, amountCents, paidAt: null }
  })
  const bill = { id: crypto.randomUUID(), homeId, title, totalCents, shares }

  // D1 executes this batch as a transaction. A failed share insert rolls back
  // the bill and every preceding share, so a partial bill is never persisted.
  await db.batch([
    db
      .prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
      .bind(bill.id, homeId, title, totalCents),
    ...shares.map((share) =>
      db
        .prepare(
          'INSERT INTO shares (id, home_id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(share.id, homeId, bill.id, share.memberId, share.amountCents),
    ),
  ])
  return bill
}

type BillShareRow = Omit<Bill, 'shares'> & {
  shareId: string | null
  memberId: string | null
  amountCents: number | null
  paidAt: string | null
}

export async function listBills(db: D1Database, homeId: string): Promise<Bill[]> {
  await requireHome(db, homeId)
  // Read bill headers and their persisted shares in one SQL snapshot. Separate reads
  // could combine an older bill list with payments made after a newer bill was created.
  const rows = await db
    .prepare(`
      SELECT b.id, b.home_id AS homeId, b.title, b.total_cents AS totalCents,
        s.id AS shareId, m.id AS memberId,
        s.amount_cents AS amountCents, s.paid_at AS paidAt
      FROM bills b
      LEFT JOIN shares s ON s.bill_id = b.id AND s.home_id = b.home_id
      LEFT JOIN members m ON m.id = s.member_id AND m.home_id = b.home_id
      WHERE b.home_id = ?
      ORDER BY b.ordinal, m.ordinal
    `)
    .bind(homeId)
    .all<BillShareRow>()
  const byBill = new Map<string, Bill>()
  for (const row of rows.results) {
    // An existing bill without valid share data is an invariant failure, not a valid empty bill.
    if (row.shareId === null || row.memberId === null || row.amountCents === null) {
      throw new Error('Stored bill is missing required share data')
    }
    let bill = byBill.get(row.id)
    if (!bill) {
      bill = {
        id: row.id,
        homeId: row.homeId,
        title: row.title,
        totalCents: row.totalCents,
        shares: [],
      }
      byBill.set(row.id, bill)
    }
    bill.shares.push({
      id: row.shareId,
      memberId: row.memberId,
      amountCents: row.amountCents,
      paidAt: row.paidAt,
    })
  }
  const bills = [...byBill.values()]
  for (const bill of bills) {
    // BigInt is internal to this integrity check; response amounts remain safe JSON integers.
    const sum = bill.shares.reduce((total, share) => total + BigInt(share.amountCents), 0n)
    if (sum !== BigInt(bill.totalCents))
      throw new Error('Stored bill shares do not match its total')
  }
  return bills
}

type PaymentRow = Share & { paymentKey: string | null }

export async function payShare(
  db: D1Database,
  billId: string,
  shareId: string,
  key: string,
): Promise<PaidShare> {
  // The paid_at IS NULL condition lets only one request change the row, even
  // across separate Worker instances. An in-memory lock would not protect that.
  // Selecting in the same D1 batch reads the stored winner and its original timestamp.
  const [, selected] = await db.batch<PaymentRow>([
    db
      .prepare(`
        UPDATE shares SET paid_at = ?, payment_key = ?
        WHERE id = ? AND bill_id = ? AND paid_at IS NULL
      `)
      .bind(new Date().toISOString(), key, shareId, billId),
    db
      .prepare(`
        SELECT id, member_id AS memberId, amount_cents AS amountCents,
          paid_at AS paidAt, payment_key AS paymentKey
        FROM shares WHERE id = ? AND bill_id = ?
      `)
      .bind(shareId, billId),
  ])
  // Both statements match bill and share IDs, so a share cannot be paid through another bill.
  const share = selected?.results[0]
  if (!share) throw new ApiError(404, 'Bill or share not found')
  // Matching keys replay the original success; a different key cannot change the stored payment.
  if (share.paymentKey !== key) {
    throw new ApiError(409, 'Share already paid with a different key')
  }
  if (share.paidAt === null) throw new Error('Payment transaction did not record a timestamp')
  // Return public fields only; the accepted idempotency key stays in the database.
  return {
    id: share.id,
    memberId: share.memberId,
    amountCents: share.amountCents,
    paidAt: share.paidAt,
  }
}

type BalanceRow = { memberId: string; name: string; amountCents: number | null }

export async function listBalances(db: D1Database, homeId: string): Promise<Balance[]> {
  await requireHome(db, homeId)
  // Keep the unpaid condition in the JOIN so members with only paid shares still appear.
  const rows = await db
    .prepare(`
      SELECT m.id AS memberId, m.name, s.amount_cents AS amountCents
      FROM members m
      LEFT JOIN shares s ON s.member_id = m.id AND s.home_id = m.home_id AND s.paid_at IS NULL
      WHERE m.home_id = ?
      ORDER BY m.ordinal, s.id
    `)
    .bind(homeId)
    .all<BalanceRow>()
  // Map preserves the SQL member order while accumulating multiple unpaid shares per member.
  const balances = new Map<string, Balance>()
  for (const row of rows.results) {
    let balance = balances.get(row.memberId)
    if (!balance) {
      balance = { memberId: row.memberId, name: row.name, outstandingCents: 0 }
      balances.set(row.memberId, balance)
    }
    const amount = row.amountCents ?? 0
    // Check before adding: checking a rounded result afterward could miss lost precision.
    if (amount > Number.MAX_SAFE_INTEGER - balance.outstandingCents) {
      throw new ApiError(500, 'Balance exceeds supported numeric range')
    }
    balance.outstandingCents += amount
  }
  return [...balances.values()]
}

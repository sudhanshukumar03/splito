import type { Bill, Member } from './api'

export type MemberSummary = {
  member: Member
  outstandingCents: bigint
  totalShares: number
  unpaidShares: number
}
export type LedgerSummary = {
  totalCents: bigint
  outstandingCents: bigint
  totalShares: number
  paidShares: number
  settledBills: number
  members: MemberSummary[]
}

// All pages derive their figures from the same persisted shares, without resplitting.
export function summarizeLedger(members: Member[], bills: Bill[]): LedgerSummary {
  const summaries = members.map((member) => ({
    member,
    outstandingCents: 0n,
    totalShares: 0,
    unpaidShares: 0,
  }))
  const byMember = new Map(summaries.map((item) => [item.member.id, item]))
  const result: LedgerSummary = {
    totalCents: 0n,
    outstandingCents: 0n,
    totalShares: 0,
    paidShares: 0,
    settledBills: 0,
    members: summaries,
  }
  for (const bill of bills) {
    result.totalCents += BigInt(bill.totalCents)
    let settled = true
    for (const share of bill.shares) {
      const member = byMember.get(share.memberId)
      if (!member) throw new Error('A bill share references an unknown household member')
      result.totalShares++
      member.totalShares++
      if (share.paidAt === null) {
        const amount = BigInt(share.amountCents)
        result.outstandingCents += amount
        member.outstandingCents += amount
        member.unpaidShares++
        settled = false
      } else result.paidShares++
    }
    if (settled) result.settledBills++
  }
  return result
}

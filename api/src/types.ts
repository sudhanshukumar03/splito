// Public API response shapes use camelCase; SQL columns use snake_case.
// Money is always integer cents, and internal payment keys are never exposed.
export type Home = { id: string; name: string }

export type Member = { id: string; homeId: string; name: string }

// paidAt is null until payment is recorded, including for a zero-cent share.
export type Share = {
  id: string
  memberId: string
  amountCents: number
  paidAt: string | null
}

// A successful payment response always has a timestamp, unlike an unpaid listed share.
export type PaidShare = Omit<Share, 'paidAt'> & { paidAt: string }

export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}

export type Balance = { memberId: string; name: string; outstandingCents: number }

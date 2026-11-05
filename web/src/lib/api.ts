import type { Bill, Home, Member, PaidShare, Share } from '../../../api/src/types'

export type { Bill, Home, Member, PaidShare, Share }
export type HomeDetails = Home & { members: Member[] }

export class ApiError extends Error {
  status: number
  uncertain: boolean
  constructor(message: string, status = 0, uncertain = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.uncertain = uncertain
  }
}
type Guard<T> = (value: unknown) => value is T
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const cents = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const unique = <T>(items: T[], key: (item: T) => string): boolean =>
  new Set(items.map(key)).size === items.length
const home: Guard<Home> = (value): value is Home =>
  record(value) && text(value.id) && text(value.name)
const member: Guard<Member> = (value): value is Member =>
  record(value) && text(value.homeId) && home(value)
const share: Guard<Share> = (value): value is Share =>
  record(value) &&
  text(value.id) &&
  text(value.memberId) &&
  cents(value.amountCents) &&
  (value.paidAt === null ||
    (typeof value.paidAt === 'string' && Number.isFinite(Date.parse(value.paidAt))))
const paid: Guard<PaidShare> = (value): value is PaidShare =>
  share(value) && typeof value.paidAt === 'string'
const bill: Guard<Bill> = (value): value is Bill =>
  record(value) &&
  text(value.id) &&
  text(value.homeId) &&
  text(value.title) &&
  cents(value.totalCents) &&
  value.totalCents > 0 &&
  Array.isArray(value.shares) &&
  value.shares.length > 0 &&
  value.shares.every(share) &&
  unique(value.shares, (item: Share) => item.id) &&
  unique(value.shares, (item: Share) => item.memberId) &&
  value.shares.reduce((sum: bigint, item: Share) => sum + BigInt(item.amountCents), 0n) ===
    BigInt(value.totalCents)
const details: Guard<HomeDetails> = (value): value is HomeDetails =>
  record(value) &&
  home(value) &&
  'members' in value &&
  Array.isArray(value.members) &&
  value.members.every(member) &&
  unique(value.members, (item: Member) => item.id) &&
  value.members.every((item: Member) => item.homeId === value.id)
const bills: Guard<{ bills: Bill[] }> = (value): value is { bills: Bill[] } =>
  record(value) &&
  Array.isArray(value.bills) &&
  value.bills.every(bill) &&
  unique(value.bills, (item: Bill) => item.id) &&
  unique(
    value.bills.flatMap((item: Bill) => item.shares),
    (item: Share) => item.id,
  )

async function request<T>(path: string, guard: Guard<T>, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  const timer = setTimeout(abort, 15_000)
  const writing = options.method === 'POST'
  try {
    const response = await fetch(`/api${path}`, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new ApiError(
        'The server returned an unreadable response. Please try again.',
        response.status,
        writing,
      )
    }
    if (!response.ok) {
      const message =
        record(data) && typeof data.error === 'string'
          ? data.error
          : 'The request could not be completed.'
      throw new ApiError(message, response.status, writing && response.status >= 500)
    }
    if (!guard(data))
      throw new ApiError(
        'The server returned incomplete data. Refresh to check the latest status.',
        response.status,
        writing,
      )
    return data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      controller.signal.aborted
        ? 'The request took too long. Check your connection and try again.'
        : 'Could not reach Splito. Check your connection and try again.',
      0,
      writing,
    )
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}
const id = encodeURIComponent
export const api = {
  home: (homeId: string, signal?: AbortSignal) =>
    request(
      `/homes/${id(homeId)}`,
      (value): value is HomeDetails => details(value) && value.id === homeId,
      { signal },
    ),
  bills: (homeId: string, signal?: AbortSignal) =>
    request(
      `/homes/${id(homeId)}/bills`,
      (value): value is { bills: Bill[] } =>
        bills(value) && value.bills.every((item) => item.homeId === homeId),
      { signal },
    ),
  createHome: (name: string) =>
    request('/homes', (value): value is Home => home(value) && value.name === name.trim(), {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  addMember: (homeId: string, name: string) =>
    request(
      `/homes/${id(homeId)}/members`,
      (value): value is Member =>
        member(value) && value.homeId === homeId && value.name === name.trim(),
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
    ),
  addBill: (homeId: string, title: string, totalCents: number) =>
    request(
      `/homes/${id(homeId)}/bills`,
      (value): value is Bill =>
        bill(value) &&
        value.homeId === homeId &&
        value.title === title.trim() &&
        value.totalCents === totalCents &&
        value.shares.every((item) => item.paidAt === null),
      {
        method: 'POST',
        body: JSON.stringify({ title, totalCents }),
      },
    ),
  pay: (billId: string, shareId: string, key: string, signal?: AbortSignal) =>
    request(
      `/bills/${id(billId)}/shares/${id(shareId)}/pay`,
      (value): value is PaidShare => paid(value) && value.id === shareId,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        signal,
      },
    ),
}
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.'

/**
 * Return one integer-cent amount per member, in the member order supplied by the caller.
 * For example, 1,000 cents among three members becomes [334, 333, 333].
 */
export function splitCents(totalCents: number, memberCount: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new RangeError('Total must be a positive safe integer')
  }
  if (!Number.isSafeInteger(memberCount) || memberCount <= 0) {
    throw new RangeError('At least one member is required')
  }
  // Every member gets the whole-number base; the earliest members get leftover cents.
  const base = Math.floor(totalCents / memberCount)
  const remainder = totalCents % memberCount
  return Array.from({ length: memberCount }, (_, index) => base + (index < remainder ? 1 : 0))
}

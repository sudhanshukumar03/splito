const memory = new Map<string, string>()
const storageKey = (home: string, bill: string, share: string) =>
  `splito-payment:${home}:${bill}:${share}`

// Keep the same attempt key after a timeout: the server may already have saved it.
export function paymentKey(home: string, bill: string, share: string): string {
  const key = storageKey(home, bill, share)
  let value = memory.get(key)
  if (!value) {
    try {
      value = sessionStorage.getItem(key) ?? undefined
    } catch {
      /* Memory fallback. */
    }
  }
  // Browser headers cannot transport control characters or Unicode keys. A corrupt
  // stored value must not trap every subsequent retry before it reaches the API.
  if (!value?.trim() || !/^[\x20-\x7e]+$/.test(value)) value = crypto.randomUUID()
  memory.set(key, value)
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* Keep the in-memory attempt. */
  }
  return value
}
export function forgetPayment(home: string, bill: string, share: string): void {
  const key = storageKey(home, bill, share)
  memory.delete(key)
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* Optional storage. */
  }
}

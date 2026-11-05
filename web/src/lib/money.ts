// Parse the decimal text before converting to Number: never round a fractional cent.
export function parseAmount(text: string): number {
  const value = text.trim()
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value)) {
    throw new Error('Enter an amount with up to two decimal places, such as 24.50.')
  }
  const [whole = '0', fraction = ''] = value.split('.')
  const cents = BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0'))
  if (cents <= 0n) throw new Error('The bill amount must be greater than zero.')
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('This amount is too large to split safely.')
  return Number(cents)
}

// The assignment defines 100 cents as one dollar; make the displayed unit explicit.
// BigInt also keeps household totals exact when many individually valid bills accumulate.
export function money(cents: number | bigint): string {
  const amount = BigInt(cents)
  return `$${new Intl.NumberFormat('en-US').format(amount / 100n)}.${String(amount % 100n).padStart(2, '0')}`
}

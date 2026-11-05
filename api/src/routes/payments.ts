import { Hono } from 'hono'
import { payShare } from '../db/queries'
import type { AppEnv } from '../env'
import { ApiError } from '../lib/errors'

const payments = new Hono<AppEnv>()

payments.post('/bills/:billId/shares/:shareId/pay', async (c) => {
  // The caller must reuse this key when retrying an attempt whose response was lost.
  const key = c.req.header('Idempotency-Key')
  // Reject blank keys, but do not otherwise normalize the value used for replay matching.
  if (!key || key.trim().length === 0) throw new ApiError(400, 'Idempotency-Key is required')
  // The database performs the single-payment transition; this handler needs no local lock.
  const share = await payShare(c.env.DB, c.req.param('billId'), c.req.param('shareId'), key)
  return c.json(share)
})

export default payments

import { Hono } from 'hono'
import { listBalances } from '../db/queries'
import type { AppEnv } from '../env'

const balances = new Hono<AppEnv>()

// Derive balances from unpaid shares rather than maintaining a separate mutable total.
balances.get('/homes/:homeId/balances', async (c) => {
  const result = await listBalances(c.env.DB, c.req.param('homeId'))
  return c.json({ balances: result })
})

export default balances

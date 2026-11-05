import { Hono } from 'hono'
import type { AppEnv } from './env'
import { ApiError } from './lib/errors'
import balances from './routes/balances'
import bills from './routes/bills'
import homes from './routes/homes'
import payments from './routes/payments'

// Route modules share the same typed Cloudflare bindings and /api prefix.
const app = new Hono<AppEnv>()

// Household reads and payment responses must be revalidated against current data.
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await next()
})

app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.route('/api', homes)
app.route('/api', bills)
app.route('/api', payments)
app.route('/api', balances)

// Unknown routes must use the same JSON error shape as validation failures.
app.notFound((c) => c.json({ error: 'Route not found' }, 404))
app.onError((error, c) => {
  // Expected failures carry their own status; unexpected failures return a generic message.
  if (error instanceof ApiError) return c.json({ error: error.message }, error.status)
  console.error('Unhandled API error', error)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app

import { Hono } from 'hono'
import { insertBill, listBills } from '../db/queries'
import type { AppEnv } from '../env'
import { readObject, readText, readTotal } from '../lib/validation'

const bills = new Hono<AppEnv>()

bills.post('/homes/:homeId/bills', async (c) => {
  // Validate every field before starting any database write.
  const body = await readObject(c.req)
  const title = readText(body, 'title')
  const totalCents = readTotal(body)
  const bill = await insertBill(c.env.DB, c.req.param('homeId'), title, totalCents)
  return c.json(bill, 201)
})

// Return persisted amounts and payment states so reloads reflect the database.
bills.get('/homes/:homeId/bills', async (c) => {
  const result = await listBills(c.env.DB, c.req.param('homeId'))
  return c.json({ bills: result })
})

export default bills

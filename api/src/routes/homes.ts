import { Hono } from 'hono'
import { insertHome, insertMember, listMembers, requireHome } from '../db/queries'
import type { AppEnv } from '../env'
import { readObject, readText } from '../lib/validation'

const homes = new Hono<AppEnv>()

// Validate at the HTTP boundary; database helpers handle persistence and resource checks.
homes.post('/homes', async (c) => {
  const body = await readObject(c.req)
  const home = await insertHome(c.env.DB, readText(body, 'name'))
  return c.json(home, 201)
})

homes.post('/homes/:homeId/members', async (c) => {
  const body = await readObject(c.req)
  const member = await insertMember(c.env.DB, c.req.param('homeId'), readText(body, 'name'))
  return c.json(member, 201)
})

// Supporting read lets a fresh frontend page load the home and member names.
homes.get('/homes/:homeId', async (c) => {
  const home = await requireHome(c.env.DB, c.req.param('homeId'))
  const members = await listMembers(c.env.DB, home.id)
  return c.json({ ...home, members })
})

export default homes

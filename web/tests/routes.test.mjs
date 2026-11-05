import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  createMemoryHistory,
  createRouter,
  RouterContextProvider,
  RouterProvider,
} from '@tanstack/react-router'
import react from '@vitejs/plugin-react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

let vite
let routeTree
let workspaceContext
let summarizeLedger
const homeId = 'routing-home'
const members = [
  { id: 'a', homeId, name: 'Asha Routing' },
  { id: 'b', homeId, name: 'Ben Routing' },
]
const bills = [
  {
    id: 'bill-1',
    homeId,
    title: 'Routing bill fixture',
    totalCents: 101,
    shares: [
      { id: 'share-a', memberId: 'a', amountCents: 51, paidAt: null },
      { id: 'share-b', memberId: 'b', amountCents: 50, paidAt: '2026-11-04T00:00:00.000Z' },
    ],
  },
]

before(async () => {
  // Compile the real TSX route modules without launching or controlling a browser.
  vite = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    plugins: [react()],
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
  })
  ;({ routeTree } = await vite.ssrLoadModule('/src/routeTree.gen.ts'))
  ;({ HomeWorkspaceContext: workspaceContext } = await vite.ssrLoadModule(
    '/src/lib/home-context.tsx',
  ))
  ;({ summarizeLedger } = await vite.ssrLoadModule('/src/lib/ledger.ts'))
})
after(async () => {
  await vite?.close()
})

async function routerFor(path) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    isServer: true,
    defaultPendingMinMs: 0,
  })
  await router.load()
  return router
}
for (const [suffix, title] of [
  ['', 'Overview'],
  ['/bills', 'Shared bills'],
  ['/housemates', 'Housemates'],
]) {
  test(`direct URL ${suffix || '/'} renders only its page and marks the correct navigation item`, async () => {
    const router = await routerFor(`/homes/${homeId}${suffix}`)
    const html = renderToString(createElement(RouterProvider, { router }))
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1]
    assert.ok(main, 'The nested page must render inside the household layout')
    assert.equal(main.match(/<h1\b[^>]*>(.*?)<\/h1>/)?.[1], title)
    const nav = html.match(/<nav\b[^>]*aria-label="Home navigation"[^>]*>([\s\S]*?)<\/nav>/)?.[1]
    assert.ok(nav)
    const links = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    assert.deepEqual(
      links.map((link) => link[1].match(/href="([^"]+)"/)?.[1]),
      [`/homes/${homeId}`, `/homes/${homeId}/bills`, `/homes/${homeId}/housemates`],
    )
    const active = links.filter((link) => /aria-current="page"/.test(link[1]))
    assert.equal(active.length, 1, 'Exactly one section must be active')
    assert.ok(active[0][2].includes(title))
    assert.match(active[0][1], /class="[^"]*\bactive\b/)
    assert.doesNotMatch(nav, /href="#(?:main|bills|housemates)"/)
  })
}

async function renderPage(componentName, routeSuffix) {
  const router = await routerFor(`/homes/${homeId}${routeSuffix}`)
  const module = await vite.ssrLoadModule(`/src/components/${componentName}.tsx`)
  const value = {
    homeId,
    data: { home: { id: homeId, name: 'Routing household', members }, bills },
    ledger: summarizeLedger(members, bills),
    loading: false,
    error: '',
    notice: '',
    pending: new Set(),
    paymentErrors: {},
    openDialog() {},
    refresh: async () => true,
    pay: async () => {},
  }
  return renderToString(
    createElement(
      RouterContextProvider,
      { router },
      createElement(workspaceContext.Provider, { value }, createElement(module[componentName])),
    ),
  )
}
test('populated Overview shows summaries without the bill ledger or member directory', async () => {
  const html = await renderPage('OverviewPage', '')
  assert.match(html, /Household summary/)
  assert.match(html, /Total outstanding/)
  assert.doesNotMatch(html, /Payment progress|Household workspace/)
  assert.doesNotMatch(
    html,
    /Routing bill fixture|Asha Routing|Ben Routing|class="bill-entry"|class="member-directory"/,
  )
})
test('populated Shared bills starts with compact rows and no member directory', async () => {
  const html = await renderPage('BillsPage', '/bills')
  assert.match(html, /Routing bill fixture/)
  assert.doesNotMatch(html, /class="pay-button"|class="share-list"/)
  assert.match(html, /Bill ledger/)
  assert.doesNotMatch(html, /class="member-directory"|Household summary|Payment progress/)
})
test('populated Housemates owns member balances without bill cards or payment controls', async () => {
  const html = await renderPage('HousematesPage', '/housemates')
  assert.match(html, /Asha Routing/)
  assert.match(html, /Ben Routing/)
  assert.match(html, /Outstanding balance/)
  assert.doesNotMatch(html, /Routing bill fixture|class="bill-entry"|Mark paid|Household summary/)
})

async function collapsedBill(overrides) {
  const { BillCard } = await vite.ssrLoadModule('/src/components/BillCard.tsx')
  return renderToString(
    createElement(BillCard, {
      bill: bills[0],
      members,
      pending: new Set(),
      errors: {},
      onPay() {},
      initialExpanded: false,
      ...overrides,
    }),
  )
}
test('a closed bill keeps pending payment feedback visible without rendering hidden payment rows', async () => {
  const html = await collapsedBill({ pending: new Set(['share-a']) })
  assert.match(html, /Routing bill fixture/)
  assert.match(html, /Saving payment/)
  assert.doesNotMatch(html, /class="share-list"|Mark paid/)
})
test('a closed bill exposes a failed payment and preserves its unpaid status', async () => {
  const html = await collapsedBill({ errors: { 'share-a': 'Connection lost' } })
  assert.match(html, /Payment needs attention/)
  assert.match(html, /role="alert"/)
  assert.match(html, /Part paid/)
  assert.doesNotMatch(html, /class="share-list"|Mark paid/)
})

test('opening a bill reveals its payment controls and member shares', async () => {
  const { BillCard } = await vite.ssrLoadModule('/src/components/BillCard.tsx')
  const html = renderToString(
    createElement(BillCard, {
      bill: bills[0],
      members,
      pending: new Set(),
      errors: {},
      onPay() {},
      initialExpanded: true,
    }),
  )
  assert.match(html, /class="share-list"/)
  assert.match(html, /Mark paid/)
  assert.match(html, /Asha Routing/)
})

test('the welcome route keeps its hero and explanation alongside functional household setup', async () => {
  const router = await routerFor('/')
  const html = renderToString(createElement(RouterProvider, { router }))
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1)
  assert.match(html, /id="landing-title"/)
  assert.match(html, /Shared home\./)
  assert.match(html, /Clearer bills\./)
  assert.match(html, /id="setup-title">Create a household/)
  assert.match(html, /name="homeName"/)
  assert.match(html, /name="homeId"/)
  assert.match(html, /Try a sample household/)
  assert.match(html, /id="how-it-works"/)
  assert.match(html, /Add your housemates/)
  assert.match(html, /Split a shared bill/)
  assert.match(html, /Keep track together/)
  for (const target of ['main', 'get-started', 'how-it-works']) {
    assert.ok(html.includes(`href="#${target}"`))
    assert.ok(html.includes(`id="${target}"`))
  }
})

test('returning households retain the welcome page and a working household destination', async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => JSON.stringify([{ id: 'remembered-home', name: 'Cedar Flat' }]) },
  })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  })
  const router = await routerFor('/')
  const html = renderToString(createElement(RouterProvider, { router }))
  assert.match(html, /id="landing-title"/)
  assert.match(html, /id="setup-title">Your households/)
  assert.match(html, /Cedar Flat/)
  assert.match(html, /href="\/homes\/remembered-home"/)
  assert.match(html, /Create another household/)
  assert.match(html, /name="homeName"/)
})

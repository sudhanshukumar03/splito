# Splito: System Architecture

> Status: Backend and frontend implemented; rendered browser acceptance pending.
>
> Updated: 3 November 2026.

## Contents

- [Purpose and boundaries](#purpose-and-design-boundaries)
- [System structure](#structure)
- [File structure and responsibilities](#planned-file-structure)
- [Component responsibilities](#responsibilities)
- [Sources of truth](#sources-of-truth)
- [Exact amount validation](#exact-amount-validation)
- [Bill creation](#bill-creation-flow)
- [Consistent bill listing](#consistent-bill-listing)
- [Payment concurrency](#payment-flow-and-concurrency)
- [Balance calculation](#balance-flow)
- [Frontend recovery](#frontend-request-handling)
- [Trade-offs](#decisions-benefits-and-trade-offs)
- [Remaining integration work](#remaining-integration-work)
- [Verification](#verification)

## Purpose and design boundaries

Explain how the required API, database, and routed React frontend work together.
The database is **Cloudflare D1 with SQLite SQL semantics**, required by the
assignment. Read [DATABASE-DESIGN.md](DATABASE-DESIGN.md) for the selection
rationale and data model. No separate database service or payment processor is
needed in this design.

## Structure

```text
Browser: React + Vite + TanStack Router
                |
                | /api requests
                v
Cloudflare Worker: Hono routes
                |
                | validation, split calculation, payment handling
                v
Cloudflare D1: homes, members, bills, shares
```

The pnpm workspace contains `api/` and `web/`, following the supplied template.
Package names and original test files are preserved. Type-check scheduling was
adjusted to keep native compiler memory use bounded.

## Planned file structure

The backend, migration, and frontend in this tree are implemented. Original
backend tests and support files remain unchanged. Generated dependencies are excluded from the tree below.

```text
splito/
|-- README.md
|-- PROBLEM.md
|-- PRD.md
|-- REQUIREMENTS.md
|-- API-SPECIFICATION.md
|-- SYSTEM-ARCHITECTURE.md
|-- DATABASE-DESIGN.md
|-- TODO.md
|-- .gitignore
|-- .gitattributes
|-- package.json
|-- pnpm-lock.yaml
|-- pnpm-workspace.yaml
|-- biome.json
|-- tsconfig.base.json
|-- api/
|   |-- package.json
|   |-- wrangler.jsonc
|   |-- tsconfig.json
|   |-- vitest.config.ts
|   |-- migrations/
|   |   `-- 0001_init.sql
|   |-- src/
|   |   |-- index.ts
|   |   |-- app.ts
|   |   |-- types.ts
|   |   |-- env.ts
|   |   |-- routes/
|   |   |   |-- homes.ts
|   |   |   |-- bills.ts
|   |   |   |-- payments.ts
|   |   |   `-- balances.ts
|   |   |-- db/
|   |   |   `-- queries.ts
|   |   |-- domain/
|   |   |   `-- split.ts
|   |   `-- lib/
|   |       |-- validation.ts
|   |       `-- errors.ts
|   `-- test/
|       |-- .gitkeep
|       |-- apply-migrations.ts
|       |-- env.d.ts
|       |-- helpers.ts
|       |-- homes.test.ts
|       |-- bills.test.ts
|       |-- payments.test.ts
|       |-- edge-cases.test.ts
|       `-- audit-regressions.test.ts
`-- web/
    |-- package.json
    |-- FRONTEND.md
    |-- index.html
    |-- tsconfig.json
    |-- vite.config.ts
    |-- public/favicon.svg
    |-- tests/client.test.mjs
    |-- tests/ledger.test.mjs
    |-- tests/routes.test.mjs
    `-- src/
        |-- main.tsx
        |-- router.tsx
        |-- routeTree.gen.ts
        |-- vite-env.d.ts
        |-- styles.css
        |-- routes/
        |   |-- __root.tsx
        |   |-- index.tsx
        |   |-- homes.$homeId.tsx
        |   |-- homes.$homeId.index.tsx
        |   |-- homes.$homeId.bills.tsx
        |   `-- homes.$homeId.housemates.tsx
        |-- components/
        |   |-- StartPage.tsx
        |   |-- HomeLayout.tsx
        |   |-- HomePageHeader.tsx
        |   |-- OverviewPage.tsx
        |   |-- BillsPage.tsx
        |   |-- HousematesPage.tsx
        |   |-- BillCard.tsx
        |   |-- ShareRow.tsx
        |   |-- PageState.tsx
        |   |-- MutationDialog.tsx
        |   |-- Modal.tsx
        |   |-- Icon.tsx
        |   `-- ThemeToggle.tsx
        `-- lib/
            |-- api.ts
            |-- use-home.ts
            |-- home-context.tsx
            |-- ledger.ts
            |-- money.ts
            |-- storage.ts
            `-- payment-attempts.ts
```

The tree omits installed `node_modules/` directories and the generated
`api/worker-configuration.d.ts`. The unused `tsconfig.base.json` contains an empty
object; the packages use independent TypeScript configurations.

### Intended file responsibilities

| File or directory                          | Intended responsibility                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Root package/workspace/configuration files | Workspace commands and Biome settings; package TypeScript settings are separate                     |
| `api/wrangler.jsonc`                       | Worker configuration, D1 `DB` binding, and migration configuration                                  |
| `api/src/index.ts`                         | Worker entry point                                                                                  |
| `api/src/app.ts`                           | Hono application, route mounting, health endpoint, and error handling                               |
| `api/src/env.ts`                           | Application binding types; generated runtime types already exist in `api/worker-configuration.d.ts` |
| `api/src/routes/homes.ts`                  | Home creation, member addition, and home/member read                                                |
| `api/src/routes/bills.ts`                  | Bill creation and bill listing                                                                      |
| `api/src/routes/payments.ts`               | Share-payment endpoint and idempotency handling                                                     |
| `api/src/routes/balances.ts`               | Outstanding-balance endpoint and checked accumulation                                               |
| `api/src/db/queries.ts`                    | Parameterized D1 queries and atomic batches                                                         |
| `api/src/domain/split.ts`                  | Integer-cent split calculation                                                                      |
| `api/src/lib/`                             | Input validation and consistent API errors                                                          |
| `api/migrations/`                          | Versioned schema migrations with named constraints                                                  |
| `api/test/`                                | Original assignment tests and helper, followed by focused additional tests                          |
| `web/src/main.tsx`                         | Browser application entry point                                                                     |
| `web/src/router.tsx`                       | TanStack Router configuration; home path `/homes/$homeId`                                           |
| `web/src/routes/__root.tsx`                | Root route layout and route-level fallback states                                                   |
| `web/src/routes/homes.$homeId.tsx`         | Home bill page and page-level request coordination                                                  |
| `web/src/components/BillCard.tsx`          | Bill title, total, and list of shares                                                               |
| `web/src/components/ShareRow.tsx`          | Member share, payment status, and Pay action                                                        |
| `web/src/components/PageState.tsx`         | Loading, empty, and recoverable error presentation                                                  |
| `web/src/lib/api.ts`                       | Typed HTTP requests, response handling, and timeouts                                                |
| `web/src/lib/payment-attempts.ts`          | Retained payment-attempt keys and retry recovery                                                    |
| `web/src/styles.css`                       | Page and component styles                                                                           |
| `web/public/`                              | Static SVG favicon; no remote image or font dependency                                              |

The original Vite file-routing plugin is retained. Empty proposed `root.tsx` and
`home.tsx` files were replaced with `__root.tsx`, `index.tsx`, and
`homes.$homeId.tsx`; the plugin generates `routeTree.gen.ts`. The home route
renders a persistent `HomeLayout.tsx` with Overview, Bills, and Housemates child
routes. `use-home.ts` owns requests/payments; `home-context.tsx` shares state and
`ledger.ts` derives consistent figures for every child page.
See [the frontend file map](web/FRONTEND.md#routes-and-files) for all components.
Cloudflare environment types were generated by `cf-typegen`; do not hand-write
those types or invent substitute assignment tests.

## Responsibilities

| Component        | Responsibility                                                       |
| ---------------- | -------------------------------------------------------------------- |
| Home page        | Render bills/shares and manage loading, empty, error, payment states |
| Typed API client | Send requests and convert failures into recoverable UI errors        |
| Hono routes      | Parse requests, validate input, return required status and JSON      |
| Domain functions | Calculate integer splits and enforce payment rules                   |
| Database helpers | Execute parameterized queries and atomic writes                      |
| SQL migrations   | Define schema, named constraints, and indexes                        |

Keep domain logic small and testable. Do not create generic repository frameworks
or extra services for this assignment.

## Sources of truth

| Data                                 | Authority                         | Consequence                                                |
| ------------------------------------ | --------------------------------- | ---------------------------------------------------------- |
| Member order                         | Database-generated member ordinal | Split and balance queries explicitly order by it           |
| Bill membership and amount           | Persisted bill and shares         | Later member additions do not redistribute old bills       |
| Paid status, accepted key, timestamp | Stored share row                  | Browser state cannot authorize or reverse payment          |
| Outstanding amount                   | Current unpaid share rows         | Derive it rather than maintaining a second mutable balance |

## Exact amount validation

JSON parsing can round a decimal token before a normal integer check runs. The
request parser uses the native JSON reviver's original `source` to verify that
`totalCents` exactly equals its positive safe-integer value. It compares decimal
digits and exponent position, rather than performing floating-point arithmetic.

An invalid numeric amount is represented internally as NaN so `readTotal`
returns the required 422 response. It is never persisted or sent as a successful
amount. Valid integral decimal/exponent forms remain supported. JSON syntax errors
still return 400. This behavior is verified inside the configured Workers runtime.
See [the ECMAScript JSON parsing specification](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.parse).

## Bill creation flow

1. Validate input and find the home.
2. Read members in persisted insertion order.
3. Reject a home without members with 422.
4. Calculate integer shares and verify their sum equals the bill total.
5. Insert the bill and all snapshot shares in one D1 batch.
6. Return 201 only after the batch succeeds.

Cloudflare documents D1 batches as transactions that roll back the sequence on
statement failure. Use that guarantee to prevent partially created bills.
See [D1 batch documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

Proposed snapshot boundary: members read for creation determine that bill's
shares. Members added afterward participate in later bills. Do not claim that
the application-level member read and subsequent write batch are one transaction.
Overlapping member-add and bill-create requests are resolved by that snapshot
read: a member not visible in it appears only on later bills. This plan assumes
there is no member deletion or reassignment operation.

## Consistent bill listing

After confirming the home exists, one joined SQL query reads bills, stored
shares, and member ordering. Group rows into the public bill responses in memory.
This prevents an old header query from being combined with payments made after
a newer bill was committed.

A missing share/member or a share sum that differs from the bill total is an
internal data-integrity error. The API returns generic JSON 500 instead of a
misleading successful bill. An internal BigInt sum keeps this integrity check
exact; public monetary fields remain safe integer numbers.

## Payment flow and concurrency

The authoritative operation is a conditional database update scoped to both bill
and share, conceptually:

```sql
UPDATE shares
SET paid_at = ?, payment_key = ?
WHERE id = ? AND bill_id = ? AND paid_at IS NULL;
```

1. Validate the idempotency header.
2. Execute the conditional update with bound parameters.
3. Read the stored row for that bill/share in a consistent database operation.
4. If absent, return 404.
5. If its stored key matches this request, return 200 with its stored timestamp.
6. Otherwise return 409.

Proposed implementation: put the update and subsequent select in one D1 batch
so result classification observes the payment state consistently. Create the
timestamp once per attempted update; always return the stored timestamp on replay.

An application-level read followed by an unconditional update cannot protect
against simultaneous requests. The database condition performs that protection.
Two same-key calls can return the same result; only one may change payment state.

| Stored state                  | Incoming key      | Outcome                                |
| ----------------------------- | ----------------- | -------------------------------------- |
| Unpaid                        | Valid key A       | Record A and timestamp; return 200     |
| Paid with A                   | A                 | Return the existing result with 200    |
| Paid with A                   | B                 | Leave state unchanged; return 409      |
| Resource absent or mismatched | Valid key         | No payment change; return 404          |
| Any                           | Missing/blank key | Reject before payment work; return 400 |

Do not rely on an in-memory lock in a Worker: requests can reach separate Worker
instances. Correctness must come from the database operation and its predicate.

## Balance flow

1. Resolve the home; return 404 if absent.
2. Read members with their unpaid shares in one ordered, home-scoped query.
3. Start every member at zero, including members with no shares.
4. Add each share using checked integer arithmetic. Before adding amount `a` to
   balance `b`, require `a <= Number.MAX_SAFE_INTEGER - b`.
5. Return the ordered balances, or the documented 500 numeric-range error if
   any member's sum exceeds the supported range.

This avoids silently losing precision when many individually valid bills are
combined. For a small household, processing these rows is a reasonable trade-off
for explicit numeric correctness. Do not call an unchecked SQL `SUM` and assume
its conversion to a JavaScript number remains exact.

## Frontend request handling

- Implemented routes: `/` for setup, `/homes/$homeId` for Overview,
  `/homes/$homeId/bills` for Shared bills, and `/homes/$homeId/housemates` for members.
- The home parent stays mounted between pages; navigation does not reset payment attempts.
- Nav links use exact active matching; each child owns its heading and work surface.
- Fetch home/member details and bill data using the supporting read contracts.
- Use a development proxy for `/api` from port 5173 to port 8787.
- Keep load errors separate from payment errors so existing data remains visible.
- Keep payment state per share and disable its button while pending.
- Retain a share's attempt key in session storage across retries and same-tab
  reloads after uncertain failures; clear it only after confirmed paid status.
- Change paid status only on a validated payment response or confirmed read.
- Merge locally confirmed payments into refresh results so an older GET cannot undo them.
- Derive displayed balances with BigInt from persisted bill shares in the same response.
- Block automatic creation retries; uncertain member/bill writes require a fresh read.
- Handle non-2xx responses, network failures, and unexpected response bodies.
- Ignore stale responses when navigating to a different home.
- Use a 15-second client request timeout, then offer Retry. Timeout or
  abort is a browser state change and does not guarantee database cancellation.
- If session storage is unavailable, keep the key in memory for current-page
  retries; after a reload, refetch share status before starting another attempt.

If a response is lost after the server records payment, the browser can still
show unpaid temporarily. Retrying with the same key reconciles to the stored
payment safely. A 409 from another attempt can trigger a fresh bill read while
the original failed action still displays its error.

## Validation and error boundary

Use TypeScript without `any`, parse untrusted JSON as `unknown`, and validate it
before use. Use bound SQL parameters. Map expected failures to required statuses
and unexpected exceptions to generic JSON 500 responses. Keep diagnostic details
in server logs rather than response bodies.

No authentication or ownership security model is included in the assignment.
Resource relationship checks, such as matching a share to its bill, are still
required for data correctness.

## Decisions, benefits, and trade-offs

| Decision                                          | Why it fits                                       | Trade-off                                                   |
| ------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Direct D1 binding and prepared statements         | Matches required platform and keeps SQL visible   | Application depends on the D1 API                           |
| Bill/share atomic batch                           | Prevents partial creation                         | Membership read precedes, rather than belongs to, the batch |
| Conditional payment update plus select in a batch | Records once and classifies retries consistently  | Requires explicit key handling in server and browser        |
| Checked per-member accumulation                   | Makes numeric overflow detectable before addition | Reads unpaid share rows instead of only aggregate totals    |
| No optimistic paid update                         | Matches required failed-payment behavior          | A successful action waits for API confirmation              |

## Remaining integration work

- Complete rendered checks at 320, 390, 768, and 1440px, both themes, keyboard
  focus, reduced motion, target geometry, and browser console/runtime states.
- Browser tooling was unavailable during implementation; these checks remain open.
- Preserve the original backend tests and helper during further changes.
- Read-after-write behavior if D1 read replication is enabled later; the initial
  plan does not enable replicas. Payment classification stays in its write batch.
- Deployment and frontend hosting remain separate, unfinished release tasks.

## Verification

Run the supplied Vitest suite inside the Workers runtime. Add focused checks for
rollback, exact splits, repeated payments, concurrent payments, and balance
aggregation where not already covered. Exercise the page with delayed responses,
failed payments, and 500 errors. Finish with Biome, type checks, and the web build.

All 74 backend tests pass, including explicit concurrent API calls and forced
write failure. Test files run one at a time to bound local runtime memory.
The 30 audit regression tests include controlled writes after reads to reproduce
race conditions deterministically. Package type checks use native compiler
single-threaded mode and run sequentially.
This changes scheduling, not validation rules or request concurrency.
The frontend additionally passes 46 client regressions, its production build,
and a local typed-client/API integration check through Vite. Rendered acceptance
evidence and its limits are recorded in [web/FRONTEND.md](web/FRONTEND.md).

Detailed contracts are in [API-SPECIFICATION.md](API-SPECIFICATION.md); execution
and release gates are in [TODO.md](TODO.md).

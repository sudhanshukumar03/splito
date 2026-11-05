# Splito: Feature and Logic Audit

Reviewed: 4 November 2026. Scope: the supplied assignment, all application routes,
SQL migrations and queries, client validation, creation/payment recovery, and
project documentation. The assignment is authoritative; the design reference
does not add payer, currency-selection, date, or authentication contracts.

## Outcome

The required backend endpoints and frontend bill/payment features are present.
No critical backend defect was found in this pass. Confirmed recovery and
validation defects were fixed. Automated verification passes, but browser
interaction/visual acceptance and submission preparation remain incomplete.
Passing tests are evidence for their scenarios, not a guarantee of zero bugs.

## Findings and changes

| Priority  | Finding and practical effect                                                                                                                                                  | Resolution and evidence                                                                                                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medium    | A successful bill/member POST closed its dialog before the following GET completed. A failed GET hid the saved record and allowed another creation.                           | `CreationAttempt` distinguishes a confirmed write from its refresh. The dialog stays locked after confirmation; retry issues reads only. Tests cover POST 201 / GET 500 / GET 200, a thrown refresh, and concurrent submission.               |
| Medium    | Runtime response guards accepted duplicate bill/member/share IDs and multiple shares for one member. Malformed successful responses could inflate totals or break React keys. | Reject duplicate identities, cross-home relationships, blank required strings, invalid sums, and mismatched creation/payment responses before consuming them. A rejected write response remains uncertain; it is never retried automatically. |
| Medium    | A corrupt stored payment key containing control characters or Unicode could fail HTTP header construction on every retry.                                                     | Replace nontransportable stored values before sending, retain valid opaque keys, and keep the replacement stable for retries. Four corrupt-key cases and existing reload/replay cases pass.                                                   |
| Low       | Remembered-home storage accepted blank entries and duplicate IDs, producing empty or repeated navigation entries.                                                             | Filter invalid entries and deduplicate by ID, preserving the most recent valid entry.                                                                                                                                                         |
| Low       | Decimal amounts had no visible unit, and a code comment incorrectly called them currency-neutral.                                                                             | Follow the assignment's 100 cents = 1 dollar rule: display `$` and label bill input in dollars. Storage and calculations remain integer cents; aggregate displays use BigInt.                                                                 |
| Low       | A local payment confirmation claimed everyone's balances were up to date, although other clients' changes had not been fetched.                                               | Confirmation now states only `Payment recorded.`                                                                                                                                                                                              |
| Low       | PRD delivery text claimed frontend recovery had not been implemented; frontend documentation contradicted the current simplified layout.                                      | Reconcile current implementation, evidence, units, and remaining checks across the documents.                                                                                                                                                 |
| Hardening | Browser/API responses had no explicit fresh-data cache policy. This is a stale-data risk, not a reproduced database corruption bug.                                           | API responses set `Cache-Control: no-store`; the client requests `cache: 'no-store'`. Success, validation-error, and missing-resource header tests pass.                                                                                      |

The first 22 new boundary/storage/cache checks failed against the previous
behavior and pass after the changes. The creation workflow has four additional
regressions. Original assignment tests, migration helper, and lockfile remain
unchanged. No dependency, database schema, or required API payload was changed.

## Required feature coverage

| Area               | Implementation and verification                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homes and members  | Required POST routes, validation, 201/404 handling, persisted insertion order; original and edge-case tests pass.                                                                                                      |
| Bill creation      | Positive safe-integer cents; exact raw-number validation; no-member rejection; remainder distributed in added-member order; atomic bill/share batch.                                                                   |
| Membership changes | Each bill preserves its captured member snapshot. Later members join future bills; they do not acquire old shares.                                                                                                     |
| Share payments     | Required key, missing/mismatched resource errors, same-key replay with original timestamp, different-key 409, concurrent single transition.                                                                            |
| Balances           | Sum only unpaid shares in member order; include members without bills; explicitly fail on aggregate numeric overflow.                                                                                                  |
| Data protection    | SQL migration with 13 named constraints, same-home composite foreign keys, unique bill/member shares, checked amounts/payment state, bound parameters, rollback tests.                                                 |
| Supporting reads   | Home/member and joined bill/share reads support reloads; household isolation and stored-share integrity checks pass.                                                                                                   |
| Frontend pages     | Setup, Overview, Shared bills, Housemates, search/filter, explicit bill expansion, payment controls, member balances. Route/content regressions pass.                                                                  |
| Failure handling   | Loading/empty/error states, 15-second timeout, retained payment keys, no automatic creation retries, locked confirmed creation during refresh recovery. Client tests pass; actual browser interaction remains pending. |
| Tooling            | Hono/Workers, D1, React/Vite/TanStack Router, TypeScript, Workers Vitest, pnpm/Biome retained.                                                                                                                         |

## Clarifications that prevent incorrect product logic

- **Recording a payment does not transfer money.** The stored timestamp confirms
  an application record, not a bank transaction.
- **Outstanding shares are not person-to-person debts.** There is no `paidBy`
  field, so Splito cannot calculate who reimburses which payer. Do not label the
  present balances as net debts or settlement recommendations.
- **Zero cents and paid status are separate.** A zero-cent share starts unpaid
  under the assignment and can be explicitly marked paid. An open bill can
  therefore have no remaining monetary amount.
- **Same-key concurrent successes are valid.** Both requests can return the
  original result while the database performs only one unpaid-to-paid mutation.
- **Idempotency is scoped to a share.** Reusing a key on a different share is
  allowed; a key is not a globally unique transfer identifier.
- **Names/titles are not unique keys.** Identical legitimate bills or member
  names are allowed. Deduplicating financial writes by title/amount would lose
  real records.
- **The bill batch does not make one remote query per member.** Cloudflare
  documents a batch as one query against the invocation query limit; individual
  statement, result-size, and duration limits still apply. See
  [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Remaining work and limits

### Required acceptance and submission

1. Exercise real browser payment failures, slow responses, navigation during
   requests, dialog retry/focus, keyboard access, and narrow-screen layouts.
   Browser automation is unavailable in this session. Server-rendered tests do
   not verify painted layout, hydration, or actual focus behavior.
2. Create the public template-based submission repository. The local folder
   currently has no Git repository metadata; no public submission URL is recorded.
3. Record the required accessible video of at most three minutes, submit the
   repository/video links, and disclose AI assistance in the application form.

The README's required Decisions section contains exactly three choices.

### Deployment and larger-product decisions

- Remote deployment is not configured: D1 uses `database_id: "local-only"`.
  Vite's `/api` proxy is a development setting. Hosting must route production
  `/api` requests to the Worker and support direct SPA URLs before publication.
  Building `web/dist` alone does not provide that integration.
- Accounts and authorization are absent by assignment scope. Anyone with a home
  URL can read/update it, as stated in the interface. A private multi-user service
  needs an identity and permissions design before it can promise private access.
- Home/member/bill creation is not server-idempotent. If a POST commits but its
  response is lost, a fresh manual submission can still create another record.
  The UI blocks immediate ambiguous resubmission; broader exactly-once creation
  needs an API/database contract extension. Confirmed-save refresh retries are
  now protected, but unknown outcomes cannot be inferred from matching names.
- History reads are unpaginated. Pagination and request-size/rate policies are
  scaling decisions; no arbitrary limits were added to the assignment contract.
- A member balance exceeding `Number.MAX_SAFE_INTEGER` returns an explicit JSON
  500 instead of silently rounded cents. The UI can display exact BigInt totals;
  changing the balances API to decimal strings would require a contract change.
- Edit/delete/archive, payer tracking and net settlement, custom splits,
  recurring bills, categories, notifications, realtime updates, multicurrency,
  and payment-gateway integration are optional extensions, not missing mandatory
  assignment features.

## Verification

| Check                              | Result                                                                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend Workers tests              | 77 passed: 24 original, 20 edge cases, 30 earlier audit regressions, 3 cache-policy cases.                                                                                                               |
| Frontend tests                     | 74 passed: 34 original client cases, 22 boundary/storage/cache cases, 4 creation recovery cases, 3 ledger cases, 11 route/content/disclosure cases (including two subsequent landing restoration cases). |
| TypeScript                         | Both packages pass.                                                                                                                                                                                      |
| Biome                              | Passed: 82 files checked.                                                                                                                                                                                |
| Production build                   | Passed: 138 modules; production assets generated.                                                                                                                                                        |
| Original files and lockfile hashes | All six original test/helper files and the template lockfile match their recorded Git blob hashes.                                                                                                       |
| Browser acceptance                 | Incomplete; browser host unavailable.                                                                                                                                                                    |

See [TODO.md](TODO.md) for completion tracking and [README.md](README.md) for
local commands. The detailed earlier backend fixes remain documented there.

Read-only smoke verification also passed: proxied health and all four page URLs
return 200, the live API exposes the no-store header, and the existing isolated
QA home’s ordered balances equal its persisted unpaid shares. Existing homes
were not changed. Development services remain running.

Subsequent UI correction: restored the fuller welcome hero and explanation at
the user’s request. This presentation change preserves the audited backend and
creation/payment recovery logic; current frontend verification includes two new
welcome-route regression cases. See [the frontend guide](web/FRONTEND.md#welcome-page-restored---4-november-2026).

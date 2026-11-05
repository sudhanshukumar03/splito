# Splito: Implementation Checklist

> Status: Backend and frontend implemented; browser acceptance and submission pending.
>
> Updated: 4 November 2026.

Completed items reflect setup, implemented source, or the specific checks recorded below. Unchecked items are future work.
Complete Part 1 before Part 2.

## How to use this checklist

Read [README.md](README.md) for document navigation and
[REQUIREMENTS.md](REQUIREMENTS.md) for acceptance criteria. Mark a task complete
only when its code exists and its stated verification has succeeded. Dependencies
flow from setup to data model to API to frontend to submission.

Backend source, the migration, and original tests are present. All 77 backend
tests pass. The frontend production build, 74 client regressions, and local API
integration pass. Next, complete rendered browser acceptance; source/build
verification does not replace visual and keyboard checks.

## 1. Complete starter integration

- [ ] Use the supplied template to create a public Splito repository.
- [ ] Preserve these documents in the final submission repository.
- [x] Import the original backend starter and tests without changing supplied tests.
- [x] Retain the template React/routing setup and generate the tracked route tree.
- [x] Inspect the supplied assignment instructions, package scripts, and dependency versions.
- [x] Read the supplied homes, bills, payments tests, and test helper unchanged.
- [x] Review unspecified backend validation details against the supplied tests.
- [x] Reconcile policies DES-01 through DES-08 with unchanged original and focused edge-case tests.
- [x] Import the template D1 `DB` binding and retain its package names.
- [x] Run `pnpm install --frozen-lockfile` in the local Splito root.
- [x] Retain the template's build-script approvals for `esbuild` and `workerd`.
- [x] Generate Cloudflare types and verify installed tool versions.
- [x] Confirm `/api/health` and database-backed reads work on the local API.
- [x] Confirm the implemented Vite app serves its root, home URL, and API proxy.

## 2. Part 1: homes and members

- [x] Write the initial SQL migration under `api/migrations/`.
- [x] Define and explain at least three named data-protection constraints.
- [x] Implement typed JSON parsing, validation, and the JSON error boundary.
- [x] Implement `POST /api/homes` with the exact 201 response.
- [x] Implement `POST /api/homes/:homeId/members` with 201/404 responses.
- [x] Persist member insertion order using database-generated ordinals.
- [x] Verify `api/test/homes.test.ts` passes without changes.

Exit gate: homes and member endpoints pass their visible tests; member order and
referential constraints are verified before proceeding to bill creation.

## 3. Part 2: bill creation

- [x] Implement positive safe-integer total validation without numeric coercion.
- [x] Reject missing homes and homes without members using required statuses.
- [x] Implement the integer division/remainder split in member insertion order.
- [x] Allow zero-valued shares for small positive totals.
- [x] Create bill and shares in an atomic D1 batch.
- [x] Return the required bill/share payload with all `paidAt` fields null.
- [x] Verify exact divisibility, uneven totals, one member, and small totals.
- [x] Verify failed writes leave no partial bill or shares.
- [x] Verify the membership snapshot stays fixed after later member additions.
- [x] Verify `api/test/bills.test.ts` passes without changes.

## 4. Part 2: payments and balances

- [x] Require an `Idempotency-Key` on payment requests.
- [x] Implement the conditional unpaid-to-paid update.
- [x] Return the stored payment for a same-key retry without changing its time.
- [x] Return 409 for a different key after payment.
- [x] Return 404 for missing or mismatched bill/share resources.
- [x] Verify two different-key concurrent requests record only one payment.
- [x] Verify concurrent same-key calls safely return the same stored result.
- [x] Implement balances with unpaid sums, zero balances, and member ordering.
- [x] Implement the documented checked-addition balance policy and range error.
- [x] Verify `api/test/payments.test.ts` passes without changes.

Exit gate: required backend contracts pass visible tests and focused checks for
rollback, duplicate requests, competing keys, and ordered balances.

## 5. Supporting reads and web page

- [x] Implement the additional home/member read and bill-list read endpoints.
- [x] Use file-based TanStack routes for Overview, Shared bills, and Housemates.
- [x] Replace anchor navigation with real page links and exact active states.
- [x] Keep bill controls and the member directory off Overview.
- [x] Verify all three routes and populated page separation with 11 route/rendering regressions.
- [x] Share request/payment state in a persistent household parent layout.
- [x] Verify the imported `/api` proxy and implement a typed API client.
- [x] Display bill totals, member shares, and paid/unpaid status.
- [x] Show loading, empty, not-found, and recoverable error states.
- [x] Add per-share pending state and disable repeated clicks during requests.
- [x] Generate an attempt key and retain it when retrying an uncertain payment.
- [x] Retain pending keys in session storage across same-tab reloads and handle
  unavailable storage with in-memory retries plus status refetch on reload.
- [x] Add the proposed 15-second request timeout and a usable retry action.
- [x] Mark a share paid only after a successful API response.
- [x] Keep it unpaid and show an error after failed payment.
- [x] Handle timeouts/network errors, 500 responses, and unexpected response bodies.
- [ ] Verify delayed responses and navigation do not corrupt page state.
- [ ] Verify a payment committed before a lost response reconciles on retry/read.
- [ ] Check keyboard use, clear labels, and narrow-screen readability.

Exit gate: the PRD state table is exercised, including API 500, timeout, failed
payment, and already-paid reconciliation. No failed action falsely marks paid.

Implementation items above describe code and client/API evidence, not rendered
browser acceptance. See [web/FRONTEND.md](web/FRONTEND.md) for the unobserved checks.

## 6. Final verification

- [x] Run `pnpm check` and resolve formatting/lint issues.
- [x] Run `pnpm typecheck`; application source has no explicit `any`. The route
  generator retains its upstream type assertions.
- [x] Run `pnpm test` in the Workers runtime: 77 tests pass.
- [x] Repeat the backend suite after the memory limit cleared: 77 tests passed
  again on 4 November 2026.
- [x] Run `pnpm test:web`: 74 client regression tests pass.
- [x] Exercise the typed API client through Vite against a separate local QA home.
- [ ] Inspect all four required widths and measure every visible interactive target.
- [ ] Exercise both themes, actual keyboard/focus, reduced motion, and browser errors.
- [x] Run `pnpm build` for the frontend.
- [x] Confirm original visible tests and `api/test/helpers.ts` match template hashes.
- [x] Apply the SQL migration in fresh Workers tests and to the local D1 database.
- [ ] Regenerate types after any Wrangler configuration change using
  `pnpm --filter bill-splitter-api cf-typegen`.
- [x] Map required features and verification gaps against evidence in `AUDIT.md`.
- [x] Update documentation to match the implementation and actual results.

Record evidence in the final README: command, actual outcome, and any remaining
limitation. A production build is an additional release check; it is not included
in the evaluator's stated four-command sequence.

## Backend audit completed

- [x] Reproduce precision loss from fractional raw JSON numeric literals.
- [x] Validate exact numeric input while preserving valid integral exponent forms.
- [x] Reproduce mixed-time bill listing under controlled concurrent writes.
- [x] Replace separate bill/share reads with one SQL snapshot.
- [x] Detect missing stored share data and mismatched bill/share sums.
- [x] Make successful payment response timestamps nonnullable.
- [x] Verify concurrent bill creation, membership snapshots, and home isolation.
- [x] Compare split results with an independent BigInt oracle at numeric boundaries.
- [x] Retain 30 audit regression tests and verify all 74 backend tests pass.
- [x] Document creation-retry, numeric-range, history-size, and scope limits.

## Current full audit

- [x] Validate duplicate IDs, relationships, and request/response identity at the client boundary.
- [x] Recover corrupt stored payment keys and recent-home entries.
- [x] Preserve a confirmed creation during read failure; retry reads without another POST.
- [x] Make dollar/cents units explicit and payment confirmation claims accurate.
- [x] Apply a no-store policy to API responses and client requests.
- [x] Record feature coverage, fixes, production limits, and missing submission work in `AUDIT.md`.

## 7. Prepare the submission

- [x] Record three implemented backend decisions in the README.
- [ ] Add real repository and demo-video links to README if desired.
- [ ] Record an accessible video no longer than three minutes.
- [ ] Explain architecture, request flow, and one meaningful trade-off.
- [ ] Cover empty homes, invalid totals, uneven splits, retries, concurrent payment,
  missing resources, slow API, and server errors in the video.
- [ ] Disclose AI tools and where they were used in the application form.
- [ ] Confirm you can explain every submitted line in a live call.
- [ ] Submit the public repository and video links in the application form.

## Evidence to record

| Check                                  | Current evidence                                           |
| -------------------------------------- | ---------------------------------------------------------- |
| Dependency installation                | Passed with the template lockfile on 3 November 2026       |
| Tool launch checks                     | Passed for Vite, Vitest, TypeScript, and Biome             |
| Cloudflare type generation             | Passed; generated D1 binding types                         |
| Backend tests, lint, type checks       | Passed: 77 tests and workspace checks                      |
| Frontend behavior and production build | Build and 74 client tests pass; browser acceptance pending |
| Submission repository and video        | Pending                                                    |

Keep detailed installed versions and command outcomes in [README.md](README.md).
Update evidence only after running the corresponding check.

# Splito: Product Requirements Document

> Status: Backend and frontend journeys implemented; browser acceptance pending.
>
> Updated: 4 November 2026.

## Purpose and authority

Define what users can do and when each flow is acceptable. The supplied
assignment establishes mandatory behavior. Choices marked **design decision**
resolve details it leaves open and must be reconciled with its original tests
before coding. The backend starter, original tests, and setup files are imported;
backend flows pass their tests. The frontend is implemented and passes its
production build and client logic checks. Its rendered journeys still require
browser verification; see [the frontend evidence](web/FRONTEND.md#verification-evidence---4-november-2026).

## Contents

- [Product goal](#goal)
- [User journeys and acceptance](#required-user-journeys)
- [Page states and recovery](#page-states-and-recovery)
- [Interface scope](#required-interface-scope)
- [Product rules](#product-rules-and-decisions)
- [Release acceptance](#release-acceptance)

## Current delivery

Homes, members, bill creation, payment recording, balances, and supporting reads
are implemented. All 77 backend tests and 74 frontend regressions pass.
Page states and recovery logic exist and have automated coverage; actual browser
interaction, focus, and visual acceptance still require verification. See
[AUDIT.md](AUDIT.md) for evidence and limits.

## Goal

Build a small, reliable household bill splitter. Prioritize correct arithmetic,
safe payment recording, and understandable code. Deliver Part 1 before Part 2.

## Required user journeys

### 1. Set up a household

Create a home using a name, then add named members through the API. Preserve
their insertion order. Adding a member to a nonexistent home returns 404.

Acceptance: creating a home and its members returns the specified 201 payloads
and satisfies the unchanged homes tests.

### 2. Record and split a bill

Submit a bill title and a positive integer amount in cents. The backend creates
one share per current member. For total `T` and member count `N`:

```text
base = floor(T / N)
remainder = T % N
share at zero-based position i = base + (i < remainder ? 1 : 0)
```

Acceptance: 1,000 cents split among three members produces 334, 333, 333 in
insertion order. An empty home or invalid total returns 422 and creates no bill.
One cent among three members produces 1, 0, 0; zero-valued shares are valid.

### 3. View bills and shares

Open one home page that loads its bills and each bill's shares. Show the title,
total, member identity, share amount, payment status, and a Pay action for unpaid
shares. Display money in dollars while retaining integer cents in API data.

Acceptance: loading, no bills, failed loading, and successful loading all have
clear states. A slow API or a 500 response does not crash the page.

### 4. Record payment

Select Pay on a share. Send an `Idempotency-Key`. Keep the share visually unpaid
while the request is pending; mark it paid only after a successful response.
Disable its Pay button while that request is pending.

Acceptance: a failed request displays an error and leaves the share unpaid.
Retrying an uncertain attempt uses its original key. A successful retry returns
the original payment result. A different key for an already paid share returns
409. Only one database transition can record payment during concurrent calls.

### 5. Read balances

The balances API returns every member in insertion order, with the sum of their
unpaid shares across that home's bills. Members with no unpaid shares have zero.

Acceptance: paying a share reduces the corresponding outstanding balance by that
share's amount without changing other members' balances.

## Page states and recovery

| State                              | What the user sees                                                 | Available action                           |
| ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| Initial load                       | Loading indicator; no misleading zero balances                     | Wait, or retry after a recoverable failure |
| Existing home, no members          | Clear explanation that members are needed before billing           | No payment action                          |
| Existing home, no bills            | Empty state explaining that no bills exist yet                     | No payment action                          |
| Data loaded                        | Bills, member names, shares, and payment status                    | Pay an unpaid share                        |
| Payment pending                    | Share still unpaid, with progress feedback                         | Its Pay action is disabled                 |
| Payment confirmed                  | Share marked paid with its stored timestamp                        | No further payment action                  |
| Payment failed or timed out        | Share still unpaid, with a local error                             | Retry using the retained attempt key       |
| Home missing                       | Clear not-found state                                              | Navigate away or correct the home URL      |
| Creation confirmed, refresh failed | Saved fields stay locked; explicit saved-but-not-refreshed message | Retry reads without another creation POST  |
| Load failed                        | Recoverable page-level error                                       | Retry loading                              |

An unpaid display following a timeout means the browser has no confirmation.
The server may already have recorded payment. Retry or refresh reconciles the
display with the server; a failed browser request cannot undo a committed payment.

## Required interface scope

One page for viewing bills and paying shares is mandatory. Forms for creating
homes, members, and bills, and an on-page balance summary, are optional additions;
the corresponding required API operations must exist regardless.

Implemented routes: `/homes/$homeId` (Overview), `/homes/$homeId/bills`
(Shared bills), and `/homes/$homeId/housemates` (Housemates). The user requested
separate management pages; Overview contains aggregate summaries; the shared navigation opens the other pages.
The assignment does not prescribe paths.
The page needs supporting read endpoints; their proposed contracts are in
[API-SPECIFICATION.md](API-SPECIFICATION.md).

## Product rules and decisions

| Rule                                         | Classification                             | Clarification                                                                           |
| -------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Use whole cents and preserve remainder order | Assignment                                 | No fractional-cent shares                                                               |
| Payment retries return the original result   | Assignment                                 | Same share and same key keep the original timestamp                                     |
| Capture membership when creating a bill      | Design decision                            | The ordered membership read defines its snapshot; subsequent additions do not change it |
| Scope idempotency to a share                 | Design decision consistent with assignment | A key used on another share is not a global conflict                                    |
| Pay zero-cent shares normally                | Design decision                            | Keep their initial `paidAt` null and allow the same payment operation                   |
| Show balances through the API                | Assignment                                 | A balance summary on the page remains optional                                          |

The assignment defines 100 cents as one dollar. Inputs accept dollar amounts
with at most two decimal places; displays use `$`. Only integer cents cross the
API boundary. No currency conversion or selection is implemented.

The API owns amounts and payment status. The frontend displays server results;
it must not independently recalculate or redistribute existing shares.

Technical decisions, validation policies, and failure handling are maintained in
[SYSTEM-ARCHITECTURE.md](SYSTEM-ARCHITECTURE.md) and
[API-SPECIFICATION.md](API-SPECIFICATION.md). They should not expand product scope.

## Release acceptance

The release is acceptable only after the implementation and its verification
are complete. Installation and document preparation alone do not satisfy this gate.

- Meet every assignment requirement in [REQUIREMENTS.md](REQUIREMENTS.md).
- Pass the unchanged visible tests and add focused coverage for missing edge cases.
- Pass `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Submit a public repository, three README decisions, and a video no longer than
  three minutes explaining architecture, data flow, one trade-off, and edge cases.
- Disclose AI tools and their use in the application form.

## Related documents

- [Problem and terms](PROBLEM.md)
- [Verifiable requirements](REQUIREMENTS.md)
- [Implementation checklist](TODO.md)

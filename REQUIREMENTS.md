# Splito: Requirements

> Status: Backend verified; frontend implemented with build/logic checks; browser acceptance pending.
>
> Updated: 4 November 2026.

The supplied assignment is authoritative. This file separates mandatory scope
from implementation choices. Requirement IDs support the build checklist and
review; they are not additional product features.

## How to use this specification

1. Implement required stack and behavior first, in Part 1 then Part 2 order.
2. Use each row's acceptance condition as review evidence.
3. Implement the explicitly proposed policies consistently across API, database,
   and frontend; do not present them as wording from the assignment.
4. Record actual outcomes in the README; do not confuse installation checks
   with application test results.

The original visible tests and `api/test/helpers.ts` are now imported and
reviewed. All 24 original tests pass unchanged, alongside 53 additional backend
tests. The frontend production build, 74 client regressions, and local API
integration pass. Rendered frontend behavior remains unverified because the
browser host is unavailable. See [verification evidence](README.md#backend-verification).
Do not alter the original tests to fit implementation choices.

## Contents

- [Required stack](#required-stack)
- [Required API behavior](#required-behavior)
- [Data protection](#required-data-protection)
- [Frontend behavior](#required-web-behavior)
- [Verification and submission](#required-verification-and-submission)
- [Requirement ownership](#requirement-ownership)
- [Edge cases](#edge-case-checklist)
- [Proposed safeguards](#proposed-safeguards-and-additions)
- [Scope exclusions](#outside-scope)

## Required stack

| ID    | Requirement                                                   | Verification                             |
| ----- | ------------------------------------------------------------- | ---------------------------------------- |
| ST-01 | Hono API running on Cloudflare Workers                        | Inspect API and run runtime tests        |
| ST-02 | Cloudflare D1 / SQLite, bound as `DB` in `api/wrangler.jsonc` | Inspect binding and migrations           |
| ST-03 | React, Vite, and TanStack Router frontend                     | Inspect web package and route            |
| ST-04 | TypeScript on both sides; no `any`                            | Review code and run type checking        |
| ST-05 | Vitest tests execute inside the Workers runtime               | Inspect test configuration and run tests |
| ST-06 | pnpm workspace; Biome formatting and linting                  | Run required root commands               |

## Required behavior

| ID    | Requirement                                              | Acceptance                                                               |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| FR-01 | Create a home from `{ name }`                            | 201 with `{ id, name }                                                   |
| FR-02 | Add a member using `{ name }`                            | 201 with `{ id, homeId, name }`; 404 for missing home                    |
| FR-03 | Preserve member insertion order                          | Splits and balances use that same order                                  |
| FR-04 | Create a bill from `{ title, totalCents }`               | 201 with bill fields and unpaid shares                                   |
| FR-05 | Reject invalid bill creation                             | 404 for missing home; 422 for no members or nonpositive/noninteger total |
| FR-06 | Store and calculate money in integer cents               | 100 cents = 1 dollar; no fractional-cent arithmetic                      |
| FR-07 | Split among all current members                          | Exactly one share per member and sum equals total                        |
| FR-08 | Assign remainder cents in member order                   | 1,000 / 3 gives 334, 333, 333                                            |
| FR-09 | Pay a share and set `paidAt`                             | 200 with `{ id, memberId, amountCents, paidAt }`                         |
| FR-10 | Require `Idempotency-Key` for payment                    | Missing key returns 400                                                  |
| FR-11 | Replay payment safely for the same share and key         | 200 with original result and unchanged timestamp                         |
| FR-12 | Reject a different key after payment                     | 409 without modifying the stored payment                                 |
| FR-13 | Reject missing bill/share and mismatched bill/share path | 404; unrelated share stays unchanged                                     |
| FR-14 | Protect concurrent payment requests                      | One unpaid-to-paid transition; losing different-key request gets 409     |
| FR-15 | Return balances across all bills of a home               | Sum only unpaid shares; list members in insertion order                  |
| FR-16 | Handle missing home in balances                          | 404                                                                      |
| FR-17 | Return JSON for every API error                          | Body is `{ "error": "message" }`                                         |

Same-key concurrent requests may both return the same successful result under
FR-11; FR-14 permits only one mutation, never two separate payments.

## Required data protection

| ID    | Requirement                                      | Acceptance                                                   |
| ----- | ------------------------------------------------ | ------------------------------------------------------------ |
| DB-01 | Schema is SQL migrations under `api/migrations/` | All migration files apply to a fresh database                |
| DB-02 | At least three explicitly named constraints      | Identify each name and the bad data it prevents              |
| DB-03 | Failures do not leave broken data                | Bill and shares are atomic; payment state remains consistent |

## Required web behavior

| ID    | Requirement                                          | Acceptance                                  |
| ----- | ---------------------------------------------------- | ------------------------------------------- |
| UI-01 | Shared bills page displays a home's bills and shares | Existing data is visible after loading      |
| UI-02 | A member can pay an unpaid share                     | Action calls the payment endpoint           |
| UI-03 | Show loading, empty, and error states                | All states are readable and recoverable     |
| UI-04 | Failed payment stays unpaid and shows an error       | No optimistic paid state survives a failure |
| UI-05 | Handle slow responses and API 500 errors             | Page stays usable and does not crash        |

## Required verification and submission

| ID     | Requirement                                           | Acceptance                                                      |
| ------ | ----------------------------------------------------- | --------------------------------------------------------------- |
| QA-01  | Preserve visible tests and `api/test/helpers.ts`      | No modifications to original supplied files                     |
| QA-02  | Pass homes, bills, and payment tests                  | `pnpm test` succeeds                                            |
| QA-03  | Pass Biome and TypeScript checks                      | `pnpm check` and `pnpm typecheck` succeed                       |
| SUB-01 | Create a public repository from the supplied template | Submission repository is publicly accessible                    |
| SUB-02 | Add a README section named `Decisions`                | Exactly three explained technical choices                       |
| SUB-03 | Record an accessible video of at most three minutes   | Architecture, flow, trade-off, and specified edge cases covered |
| SUB-04 | Submit repository and video links                     | Links entered in application form                               |
| SUB-05 | Disclose AI use and understand submitted code         | Form disclosure and ability to explain implementation           |

The assignment provides `pnpm build`; include a successful production build as
an additional release check. The evaluator explicitly runs install, Biome,
type checking, and tests. Preserve that distinction in verification reports.

## Requirement ownership

| Requirement group | Detailed specification                                       | Completion tracking                |
| ----------------- | ------------------------------------------------------------ | ---------------------------------- |
| ST-01 to ST-06    | [Architecture](SYSTEM-ARCHITECTURE.md)                       | [Setup and verification](TODO.md)  |
| FR-01 to FR-17    | [API specification](API-SPECIFICATION.md)                    | [Part 1 and Part 2](TODO.md)       |
| DB-01 to DB-03    | [Database design](DATABASE-DESIGN.md)                        | [Schema and write checks](TODO.md) |
| UI-01 to UI-05    | [Product](PRD.md) and [architecture](SYSTEM-ARCHITECTURE.md) | [Web page work](TODO.md)           |
| QA-01 to QA-03    | Original template test/config files                          | [Final verification](TODO.md)      |
| SUB-01 to SUB-05  | [README](README.md)                                          | [Submission checklist](TODO.md)    |

## Edge-case checklist

- Home has no members.
- Total is zero, negative, fractional, missing, or the wrong JSON type.
- Total divides unevenly, including a positive total smaller than member count.
- Identical payment request is sent twice.
- Different keys attempt to pay the same share at the same time.
- Bill/share is absent, or a valid share belongs to a different bill.
- A member has no bills or no remaining unpaid shares.
- API is slow, returns 500, or fails during payment.
- Payment commits but its HTTP response never reaches the browser.
- A later member is added after a bill's membership snapshot was captured.
- Multiple bills create an outstanding balance beyond the supported number range.

## Proposed safeguards and additions

These support implementation but are not explicitly prescribed assignment rules:

| ID     | Proposed policy                                     | Acceptance                                                                             |
| ------ | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| DES-01 | Accept only positive safe-integer bill totals       | Reject numeric strings, booleans, fractions, and unsafe values with 422                |
| DES-02 | Validate text and request syntax                    | Malformed JSON, missing/nonstring/blank text fields, and blank payment keys return 400 |
| DES-03 | Use opaque string IDs and UTC ISO 8601 timestamps   | Do not expose internal ordering values or payment keys                                 |
| DES-04 | Add home/member and bill read endpoints             | A fresh page load can render existing data without browser-only state                  |
| DES-05 | Use parameterized SQL and D1 atomic batches         | Partial writes and payment races cannot corrupt data                                   |
| DES-06 | Preserve uncertain payment attempts in the same tab | Session storage retains a share's key through retry or reload                          |
| DES-07 | Add unpaid amounts using checked integer arithmetic | Return the documented JSON 500 range error instead of a rounded balance                |
| DES-08 | Freeze each bill's captured membership              | Adding members later does not rewrite existing shares                                  |

Exact validation/error precedence is specified in
[API-SPECIFICATION.md](API-SPECIFICATION.md). These policies are planning
decisions. They are implemented and compatible with the unchanged original
tests; additional edge-case tests verify their specified behavior.

## Outside scope

Real payment processing, user accounts, permissions, custom split ratios,
currency conversion, recurring bills, notifications, and financial record editing.

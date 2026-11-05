# Splito: API Specification

> Status: Backend endpoints implemented; 74 Workers-runtime tests passing.
>
> Updated: 3 November 2026.

This document defines implemented required contracts and additional supporting
reads. Supplemental policies are labeled separately from assignment requirements.
The original tests have been reviewed and pass unchanged.

## Contents

- [Endpoint summary and boundaries](#purpose-and-contract-boundaries)
- [Shared conventions](#conventions)
- [Required endpoints](#required-endpoints)
- [Supporting reads](#supporting-read-endpoints)
- [Validation and error precedence](#validation-policies)
- [Verification](#verification-and-related-documents)

## Purpose and contract boundaries

This document owns HTTP request/response contracts. Required endpoints come from
the assignment. Supporting reads, representation choices, and validation details
are proposed implementation policies, not additional assignment endpoints.

| Method | Path                                     | Success | Classification            |
| ------ | ---------------------------------------- | ------- | ------------------------- |
| POST   | `/api/homes`                             | 201     | Required Part 1           |
| POST   | `/api/homes/:homeId/members`             | 201     | Required Part 1           |
| POST   | `/api/homes/:homeId/bills`               | 201     | Required Part 2           |
| POST   | `/api/bills/:billId/shares/:shareId/pay` | 200     | Required Part 2           |
| GET    | `/api/homes/:homeId/balances`            | 200     | Required Part 2           |
| GET    | `/api/health`                            | 200     | Preserve starter behavior |
| GET    | `/api/homes/:homeId`                     | 200     | Proposed supporting read  |
| GET    | `/api/homes/:homeId/bills`               | 200     | Proposed supporting read  |

## Conventions

- Base path: `/api`; development API origin: `http://localhost:8787`.
- Request bodies are JSON; send `Content-Type: application/json` when applicable.
- Money is a JSON integer in cents. Do not accept numeric strings as amounts.
- Every error body is `{ "error": "message" }`.
- Proposed representation: opaque string IDs and UTC ISO 8601 `paidAt` strings.
- Sample identifiers below are illustrative; clients must treat IDs as opaque.
- Unspecified error wording must be checked against visible tests.
- Financial values and share membership become immutable after bill creation.
  Payment changes only `paidAt` and its internal key.

## Required endpoints

### POST /api/homes

Request:

```json
{ "name": "Maple House" }
```

Success: `201`.

```json
{ "id": "home_1", "name": "Maple House" }
```

### POST /api/homes/:homeId/members

Request:

```json
{ "name": "Alice" }
```

Success: `201`.

```json
{ "id": "member_1", "homeId": "home_1", "name": "Alice" }
```

Error: `404` when the home does not exist. Persist deterministic insertion order
independently of the response fields.

### POST /api/homes/:homeId/bills

Request:

```json
{ "title": "Electricity", "totalCents": 1000 }
```

Success: `201`. Example for three members in insertion order:

```json
{
  "id": "bill_1",
  "homeId": "home_1",
  "title": "Electricity",
  "totalCents": 1000,
  "shares": [
    { "id": "share_1", "memberId": "member_1", "amountCents": 334, "paidAt": null },
    { "id": "share_2", "memberId": "member_2", "amountCents": 333, "paidAt": null },
    { "id": "share_3", "memberId": "member_3", "amountCents": 333, "paidAt": null }
  ]
}
```

| Status | Condition                            |
| ------ | ------------------------------------ |
| 404    | Home does not exist                  |
| 422    | Total is not a positive whole number |
| 422    | Home has no members                  |

Bill and shares must either all be persisted or none be persisted. Zero-cent
shares are valid when a positive total is smaller than the number of members.
Implemented snapshot semantics: the ordered membership read defines participating
members. An addition concurrent with creation belongs to this bill only if that
read includes it. An addition after the snapshot participates in future bills.

### POST /api/bills/:billId/shares/:shareId/pay

Required header:

```http
Idempotency-Key: payment-attempt-unique-value
```

No request body is required. Success: `200`.

```json
{
  "id": "share_1",
  "memberId": "member_1",
  "amountCents": 334,
  "paidAt": "2026-11-02T10:00:00.000Z"
}
```

| Status | Condition                                                                       |
| ------ | ------------------------------------------------------------------------------- |
| 400    | Idempotency key is missing; blank-key rejection is a proposed validation policy |
| 404    | Bill or share does not exist, or share does not belong to the path bill         |
| 409    | Share was already paid using a different key                                    |

Replay rules:

1. First successful request stores the key and timestamp with the share.
2. Same share and same key return 200 with the original fields and timestamp.
3. Same share and a different key return 409 after payment.
4. Concurrent different-key calls allow only one payment transition.
5. Scope a key to its share; reuse on another share is not a global conflict.

The frontend must reuse its key after a timeout or ambiguous network failure.
Never expose the stored key in the response.

The database owns payment status. A timeout does not prove failure: the payment
may have committed before the response was lost. Same-key retry returns the
recorded result. A page reload may also discover a paid share through a read.

Proposed storage policy: retain the pending key in session storage under a
home/bill/share-specific entry. Clear it after payment confirmation or a fresh
read confirming paid status. Storage is for retry recovery; it is not a source
of truth about whether the share is paid.

### GET /api/homes/:homeId/balances

Success: `200`. Members appear in insertion order.

```json
{
  "balances": [
    { "memberId": "member_1", "name": "Alice", "outstandingCents": 0 },
    { "memberId": "member_2", "name": "Bob", "outstandingCents": 333 },
    { "memberId": "member_3", "name": "Charlie", "outstandingCents": 333 }
  ]
}
```

Only unpaid shares contribute. Members with no shares have zero. An existing
home with no members returns `{ "balances": [] }`. Missing home returns `404`.

### GET /api/health

The assignment starter provides `200` with `{ "status": "ok" }`. Preserve it.

## Supporting read endpoints

The assignment requires a bill-viewing page but specifies no bill-read API.
These implemented additions support that page without changing required contracts.

### GET /api/homes/:homeId

`200` response:

```json
{
  "id": "home_1",
  "name": "Maple House",
  "members": [{ "id": "member_1", "homeId": "home_1", "name": "Alice" }]
}
```

Members use insertion order; no members gives an empty array. Missing home: 404.

### GET /api/homes/:homeId/bills

`200` response: `{ "bills": [...] }`, where each bill has exactly the public
fields shown in the create-bill response, including current share payment status.

Ordering: bills in creation order, shares in member insertion order.
A single joined query captures headers and shares from the same SQL snapshot.
An existing home without bills returns `{ "bills": [] }`. Missing home: 404.
Missing required share data or a share sum inconsistent with its bill is an
internal integrity failure and returns generic JSON 500 rather than an empty or
incorrect bill response.

## Validation policies

| Input or failure                                                     | Selected behavior                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Malformed JSON on an endpoint that requires a body                   | 400 JSON error                                                    |
| Missing, nonstring, or blank name/title                              | 400; trim accepted name/title values                              |
| Missing, nonnumeric, nonpositive, fractional, or unsafe `totalCents` | 422; never coerce or round                                        |
| Missing or whitespace-only payment key                               | 400; preserve accepted nonblank keys as opaque values             |
| Duplicate names or bill titles                                       | Allowed; public IDs identify resources                            |
| Unexpected database/runtime failure                                  | 500 with `{ "error": "Internal server error" }`                   |
| Outstanding sum cannot fit a safe JSON integer                       | 500 with `{ "error": "Balance exceeds supported numeric range" }` |
| Unmatched API route                                                  | 404 JSON error                                                    |

The original `totalCents` numeric literal is checked before accepting the parsed
number. Fractional literals that would round to an integer are rejected with 422.
Exactly integral forms such as `1000.0` and `1.5e2` are allowed. JSON parsing still
handles escaped names, nesting, and duplicate properties; the last decoded property
value is the one validated.

Maximum supported individual amount: `9,007,199,254,740,991` cents, the JavaScript
safe-integer limit. This numeric policy is a design safeguard, not a business
limit stated by the assignment. Combined balances require a separate check.

Implemented validation order for requests with multiple problems:

1. Parse and validate required input, including the payment header where relevant.
2. Resolve resources and verify parent/child relationships.
3. Apply domain rules such as no members or a conflicting payment key.
4. Handle unexpected runtime failures through the JSON error boundary.

Payment has no required JSON body, so do not introduce a body requirement there.
The assignment does not specify exact error messages or overlapping-error
precedence. Check the original visible tests before finalizing those details;
required single-error statuses above must remain intact.

## Verification and related documents

Use the original `homes.test.ts`, `bills.test.ts`, and `payments.test.ts` as
contract evidence. Add focused tests only for meaningful uncovered behavior.
The 24 original tests pass unchanged. The 50 additional backend tests cover
meaningful gaps including races, rollback, resource boundaries, and numeric limits.

- [Audit results and remaining contract limits](README.md#backend-audit-and-remaining-limits)
- [Documentation rules](README.md#documentation-rules)
- [Requirements and policy IDs](REQUIREMENTS.md)
- [Request handling and payment flow](SYSTEM-ARCHITECTURE.md)
- [Stored fields and constraints](DATABASE-DESIGN.md)

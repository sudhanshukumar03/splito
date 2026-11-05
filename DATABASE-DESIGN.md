# Splito: Database Design

> Status: D1 schema implemented; migrations and integrity checks verified.
>
> Updated: 3 November 2026.

This document describes the implemented data model. Executable SQL is in
[0001_init.sql](api/migrations/0001_init.sql). It has been applied in Workers tests
and to local D1. The migration defines 13 named constraints.

## Contents

- [Database choice and trade-offs](#purpose-and-database-decision)
- [Relationships](#relationships)
- [Tables and field purposes](#tables)
- [Named constraints](#named-constraints)
- [Cross-row invariants](#cross-row-invariants)
- [Indexes](#indexes)
- [Balances and numeric safety](#balances)
- [Consistent reads](#consistent-reads)
- [Migrations and verification](#migration-and-write-rules)

## Purpose and database decision

Use **Cloudflare D1**, Cloudflare's managed SQL database with SQLite semantics.
The assignment explicitly requires it and the `DB` binding in
`api/wrangler.jsonc`. Choosing a different primary database would fail the stated
stack requirement, even if the application behavior were otherwise correct.

D1 is accessed directly from the Worker through its database binding; this
project does not need a separately operated database server.
See the [official D1 overview](https://developers.cloudflare.com/d1/).

### Why it fits Splito

| Project need                                                   | Design fit                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| Homes, members, bills, and shares have fixed relationships     | Relational tables and joins model them directly                 |
| A share must reference a real bill and member of the same home | Named foreign keys enforce those relationships                  |
| Invalid monetary rows must be rejected                         | CHECK and NOT NULL constraints protect stored data              |
| One member must have one share per bill                        | A UNIQUE constraint prevents duplicate share rows               |
| A bill and all shares must be saved together                   | D1 transactional batches support atomic creation                |
| Payment retries and competing requests must be safe            | A conditional update and stored key enforce a single transition |
| The API must run on Workers                                    | A D1 binding matches the required runtime and test setup        |

D1 supports foreign-key enforcement, including during migrations.
See [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).
Its batch rollback behavior is documented in the
[D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
Idempotency is application logic: selecting D1 alone does not make payment
requests safe. The conditional write and stored key are essential.

### Alternatives and trade-offs

| Option                               | Decision for this assignment                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| Cloudflare D1                        | Selected: required platform and a direct fit for this relational model           |
| Standalone SQLite                    | Useful SQL semantics, but does not replace the required D1 runtime/binding       |
| PostgreSQL or MySQL                  | Alternative relational platforms for another project; outside the mandated stack |
| MongoDB or another document database | Outside the mandated stack; no requirement here calls for a document model       |
| Browser/local JSON storage           | Cannot serve as the shared API's authoritative database                          |

D1 has storage, query, and execution limits, and an individual database processes
queries one at a time. This small household workload is a reasonable fit, but a
future high-write application needs a fresh capacity review. Keep queries short
and indexed; do not assume unlimited write throughput. These are platform
trade-offs, not a reason to change this assignment's database.
See [current D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Relationships

```text
homes 1 ---- many members
homes 1 ---- many bills
bills 1 ---- many shares
members 1 -- many shares
```

Each share belongs to one bill and one member of the same home. Payment state
belongs to the share; no separate transaction ledger or real payment gateway is
needed for the assignment.

Persist homes, members, bills, and shares only. Compute balances from unpaid
shares rather than storing a second balance value that could become inconsistent.

## Tables

Conventions:

- Store SQL column names in `snake_case`; expose API fields in `camelCase`.
- Public IDs are opaque strings; internal ordinals provide ordering.
- Monetary values are integer cents; payment timestamps use UTC ISO 8601 text.
- A null `paid_at` means unpaid. A zero-valued share can still be unpaid.

### homes

| Column | Storage                   | Purpose                |
| ------ | ------------------------- | ---------------------- |
| id     | TEXT PRIMARY KEY NOT NULL | Public home identifier |
| name   | TEXT NOT NULL             | Home display name      |

### members

| Column  | Storage                           | Purpose                            |
| ------- | --------------------------------- | ---------------------------------- |
| ordinal | INTEGER PRIMARY KEY AUTOINCREMENT | Database-generated insertion order |
| id      | TEXT NOT NULL UNIQUE              | Public member identifier           |
| home_id | TEXT NOT NULL                     | Parent home                        |
| name    | TEXT NOT NULL                     | Member display name                |

Use `ORDER BY ordinal ASC` within a home. A global increasing ordinal is enough
to preserve each home's insertion order without allocating `MAX(position) + 1`
in application code. Do not use names or timestamp ties to determine order.

### bills

| Column      | Storage                           | Purpose                          |
| ----------- | --------------------------------- | -------------------------------- |
| ordinal     | INTEGER PRIMARY KEY AUTOINCREMENT | Deterministic bill listing order |
| id          | TEXT NOT NULL UNIQUE              | Public bill identifier           |
| home_id     | TEXT NOT NULL                     | Parent home                      |
| title       | TEXT NOT NULL                     | Bill display title               |
| total_cents | INTEGER NOT NULL                  | Positive integer amount          |

### shares

| Column       | Storage                   | Purpose                                      |
| ------------ | ------------------------- | -------------------------------------------- |
| id           | TEXT PRIMARY KEY NOT NULL | Public share identifier                      |
| home_id      | TEXT NOT NULL             | Supports same-home relationship enforcement  |
| bill_id      | TEXT NOT NULL             | Parent bill                                  |
| member_id    | TEXT NOT NULL             | Member owing this amount                     |
| amount_cents | INTEGER NOT NULL          | Nonnegative integer share                    |
| paid_at      | TEXT NULL                 | UTC ISO 8601 payment time; null means unpaid |
| payment_key  | TEXT NULL                 | Key accepted when recording payment          |

Public API responses omit internal ordinals and payment keys. The API generates
public IDs independently of ordering values. Foreign-key fields are nonnull.
Member deletion and reassignment are outside scope.

## Named constraints

The assignment requires at least three named constraints that protect data.
The migration implements the following 13 constraints. Integration tests verify
cross-home protection, duplicate-share rejection, valid monetary values,
consistent payment state, and rollback on a failed share insert.

| Constraint              | Intended definition                                           | Protection or purpose                                                       |
| ----------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ck_homes_name           | CHECK (length(trim(name)) > 0)                                | Reject blank home names                                                     |
| ck_members_name         | CHECK (length(trim(name)) > 0)                                | Reject blank member names                                                   |
| ck_bills_title          | CHECK (length(trim(title)) > 0)                               | Reject blank bill titles                                                    |
| fk_members_home         | members.home_id references homes.id                           | Member attached to missing home                                             |
| fk_bills_home           | bills.home_id references homes.id                             | Bill attached to missing home                                               |
| uq_members_id_home      | UNIQUE(id, home_id) on members                                | Enables composite same-home foreign keys; id is already individually unique |
| uq_bills_id_home        | UNIQUE(id, home_id) on bills                                  | Enables composite same-home foreign keys; id is already individually unique |
| fk_shares_bill_home     | shares(bill_id, home_id) references bills(id, home_id)        | Missing bill or wrong bill home                                             |
| fk_shares_member_home   | shares(member_id, home_id) references members(id, home_id)    | Missing member or member from a different home                              |
| uq_shares_bill_member   | UNIQUE(bill_id, member_id)                                    | Duplicate shares for a member on one bill                                   |
| ck_bills_total_cents    | Integer value greater than zero, within safe JS range         | Zero, negative, fractional, or unsafe totals                                |
| ck_shares_amount_cents  | Integer value at least zero, within safe JS range             | Negative, fractional, or unsafe shares                                      |
| ck_shares_payment_state | Both payment fields null, or both nonnull with a nonblank key | Partially recorded payment state                                            |

SQLite INTEGER affinity alone is insufficient validation: implement monetary
checks with `typeof(column) = 'integer'`, bounds, and NOT NULL. At the API boundary
use `Number.isSafeInteger`; do not round or coerce invalid incoming totals.
See [SQLite type affinity](https://www.sqlite.org/datatype3.html#type_affinity).

The two composite UNIQUE constraints support foreign-key definitions; they do
not provide additional uniqueness beyond the globally unique IDs. Explain the
foreign keys, amount checks, and bill/member UNIQUE constraint when demonstrating
the assignment's required data-protection constraints.

Payment-state CHECK logic must explicitly cover both valid cases:

```sql
(paid_at IS NULL AND payment_key IS NULL)
OR (
  paid_at IS NOT NULL
  AND payment_key IS NOT NULL
  AND length(trim(payment_key)) > 0
)
```

The API produces the valid timestamp format. The CHECK prevents partial state;
the conditional update, rather than this CHECK, prevents overwriting a payment.
Do not add cascading deletes: default restrictive foreign-key behavior preserves
referenced records if an unsupported manual deletion is attempted.

Names and titles need not be unique. Keys must not be globally unique: the same
key on different shares does not violate the proposed per-share replay contract.

## Cross-row invariants

Simple row CHECK constraints cannot enforce that the sum of all shares equals a
bill total or that every snapshot member has a share. Enforce those properties
through the split algorithm, atomic creation batch, and focused integration tests.
Bill listing also verifies that required share data exists and its exact sum
matches the stored total. These checks detect inconsistent stored rows; they do
not replace atomic creation or reconstruct a historical member snapshot.

Zero-cent shares are allowed. Every snapshot member still receives a share when
the total is smaller than the number of members. No special payment behavior for
zero-cent shares is prescribed; use the ordinary share-payment endpoint.

## Indexes

- Members: `(home_id, ordinal)` for ordered home membership.
- Bills: `(home_id, ordinal)` for ordered bill listing.
- Shares: unique `(bill_id, member_id)` for per-bill lookup and duplicate prevention.
- Shares: `(home_id, member_id, paid_at)` for outstanding-balance aggregation.

## Balances

First verify that the home exists. Then obtain its members and unpaid share
amounts in a single query, conceptually:

```sql
SELECT m.id AS member_id, m.name, m.ordinal, s.amount_cents
FROM members AS m
LEFT JOIN shares AS s
  ON s.member_id = m.id
  AND s.home_id = m.home_id
  AND s.paid_at IS NULL
WHERE m.home_id = ?
ORDER BY m.ordinal ASC, s.id ASC;
```

Keep the unpaid condition in the join so members who have only paid shares still
produce a row. A null share amount means zero contribution. Start one output
balance per member and accumulate in member order.

Before adding `amountCents` to an existing balance, require:

```text
amountCents <= Number.MAX_SAFE_INTEGER - outstandingCents
```

If the check fails, stop and return the documented JSON 500 numeric-range error;
never return partial or rounded balances. This defensive policy is implemented.
Every individual amount is already bounded by its schema/API validation.

This checked row-by-row approach avoids precision loss during JavaScript
conversion and avoids relying on an SQL SUM that can itself overflow. For this
small project, clarity is preferable to introducing a second stored total or a
custom arbitrary-precision money response format.
SQLite documents integer overflow behavior for
[SUM](https://www.sqlite.org/lang_aggfunc.html#sumunc).

An existing home without members returns an empty list. A member without unpaid
shares returns zero. A missing home returns 404 instead of an empty list.

## Consistent reads

Bill listing reads headers and shares in one joined statement, ordered by bill
and member ordinal. This captures one database snapshot rather than combining
results from separate reads. Balances likewise read members and unpaid share
amounts in a single statement. Home existence checks precede these reads; there
is no home deletion or rename endpoint in the current scope.

## Migration and write rules

- Put versioned SQL files in `api/migrations/`, beginning with `0001_init.sql`.
- Create parent tables before child tables; apply every migration in order.
- Keep foreign key enforcement enabled and verify it in Workers runtime tests.
- Create bill and share rows atomically using D1 batch operations.
- Record payment key and timestamp together with a conditional update.
- Do not add update/delete flows that could alter existing financial history.
- Confirm a failed batch leaves neither a bill nor partial shares behind.

## Verification responsibilities

- Confirm invalid foreign keys, cross-home shares, duplicate bill/member pairs,
  invalid monetary values, and partial payment state are rejected.
- Confirm member insertion ordering under concurrent additions.
- Confirm bill/share rollback, same-key replay, different-key conflict, and a
  single unpaid-to-paid transition under concurrent calls.
- Confirm zero-balance members, empty homes, and checked numeric-range handling.
- Run final database verification in the Workers runtime, not only standalone
  SQLite, because the deployed access layer is D1.

See [API-SPECIFICATION.md](API-SPECIFICATION.md) for public contracts and
[TODO.md](TODO.md) for implementation order.

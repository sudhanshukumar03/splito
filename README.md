# Splito

Split bills. Share fairly.

> Status: Backend and frontend implemented; browser acceptance and submission pending.
>
> Updated: 4 November 2026.

Splito is a shared-household bill splitter for the **SDE Intern Assignment:
Shared Bill Splitter**. Its backend manages homes and members, divides bills
into exact integer-cent shares, and records individual payments safely.
The React interface now supports home setup, shared bills, housemate balances, and payment recording.

The current feature/logic review, fixes, required-feature matrix, and remaining
release work are recorded in [AUDIT.md](AUDIT.md).

## Contents

- [Current status](#project-status-and-next-step)
- [Documentation guide](#documentation)
- [Tools and responsibilities](#tools-and-responsibilities)
- [Database choice](#database-choice)
- [Installed versions](#installed-dependency-baseline)
- [Backend verification](#backend-verification)
- [Frontend verification](#frontend-verification)
- [Backend audit and remaining limits](#backend-audit-and-remaining-limits)
- [Local setup](#setup-in-the-assignment-template)
- [Project commands](#commands)
- [Technical decisions](#decisions)
- [Submission](#verification-and-submission)

## Project status and next step

| Area                                         | Status                                          |
| -------------------------------------------- | ----------------------------------------------- |
| Dependencies and template configuration      | Installed using the original lockfile           |
| Backend starter and original tests           | Imported and reviewed; supplied tests unchanged |
| Homes, members, bills, payments, balances    | Implemented                                     |
| Supporting home/member and bill reads        | Implemented                                     |
| D1 schema and named constraints              | Implemented and applied locally                 |
| Backend tests and workspace quality checks   | Passing; see verification below                 |
| Frontend starter, page, and production build | Implemented; build and 46 client tests pass     |
| Public submission repository and video       | Pending                                         |

Next, complete the rendered browser acceptance checks described in
[the frontend guide](web/FRONTEND.md), then prepare the submission. This is a standalone
Splito project at `C:\Users\sksin\OneDrive\Desktop\splito`.

## File structure

The backend lives in `api/`, with routes, database operations, input validation,
a pure split calculation, and the SQL migration. Original tests and support files
are present in `api/test/`; additional checks are in `edge-cases.test.ts`.

The frontend under `web/src/` contains file-based TanStack routes, a responsive
household ledger, native form dialogs, exact money helpers, and a typed API client.
Client, shared-ledger, and server-rendered routing regressions live in `web/tests/`. The unused root
`tsconfig.base.json` contains a valid empty object; package TypeScript settings
remain independent.

See the [file tree and responsibilities](SYSTEM-ARCHITECTURE.md#planned-file-structure).

## Features

- Create homes and add members in a preserved order.
- Split a bill among the home's members, distributing remainder cents fairly.
- Record share payment with safe retries and concurrent-request protection.
- Calculate each member's outstanding balance across unpaid shares.
- Use separate Overview, Shared bills, and Housemates pages with active navigation.
- Review all bill shares and payments on Shared bills; view member balances on Housemates.
- Create/open homes, add housemates and bills, and search/filter bills in a dark interface.
- Recover from loading failures and failed payments with explicit retry controls.

No real money transfers or payment gateway are included.

## Tools and responsibilities

| Tool                              | Responsibility in Splito                                         | Why it is included                               |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| React                             | Build the bill and share interface                               | Required frontend library                        |
| Vite                              | Serve the frontend locally and build production assets           | Required build tool                              |
| TanStack Router                   | Handle frontend routes                                           | Required router                                  |
| Hono                              | Define HTTP endpoints and return API responses                   | Required backend framework                       |
| Cloudflare Workers                | Run the backend                                                  | Required runtime                                 |
| Cloudflare D1                     | Store relational data using SQLite SQL semantics                 | Required database                                |
| Wrangler                          | Run the Worker locally, manage D1 migrations, and generate types | Cloudflare tool included in the template         |
| TypeScript                        | Check types across frontend and backend                          | Required language; do not use `any`              |
| Vitest and Cloudflare test plugin | Run API tests inside the Workers runtime                         | Required test framework and template integration |
| Biome                             | Check formatting, lint rules, and imports                        | Required quality tool                            |
| pnpm                              | Install dependencies and run workspace scripts                   | Required package manager                         |
| concurrently                      | Start API and web development processes together                 | Utility included in the template                 |

**Package manager and build tool are different roles.** pnpm runs a script such
as `pnpm build`; that script invokes Vite to build the frontend. Biome checks
code quality, while TypeScript and tests provide separate correctness checks.

## Documentation

Read these files in the listed order. Each document has a distinct purpose.

| Document                                         | Purpose                                                              | Assignment requirement?                       |
| ------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------- |
| [PROBLEM.md](PROBLEM.md)                         | Problem, users, outcomes, and scope boundaries                       | Supporting document                           |
| [PRD.md](PRD.md)                                 | Product journeys and acceptance criteria                             | Supporting document                           |
| [REQUIREMENTS.md](REQUIREMENTS.md)               | Required stack, behavior, UI, verification, and submission checklist | Supporting document                           |
| [API-SPECIFICATION.md](API-SPECIFICATION.md)     | Requests, responses, errors, replay behavior, proposed read APIs     | Supporting document                           |
| [SYSTEM-ARCHITECTURE.md](SYSTEM-ARCHITECTURE.md) | Components, data flow, atomicity, and error handling                 | Supporting document                           |
| [DATABASE-DESIGN.md](DATABASE-DESIGN.md)         | Tables, relationships, named constraints, and indexes                | Supporting document                           |
| [TODO.md](TODO.md)                               | Ordered implementation and submission checklist                      | Supporting document                           |
| [README.md](README.md)                           | Project entry point, setup, commands, and decisions                  | Required update; must contain three decisions |

### Documentation rules

- **Required** means the behavior is specified by the assignment.
- **Proposed** means a design choice for details the assignment leaves open.
- **Verified** means an action was completed and its outcome was checked.
- **Pending** means work or verification has not been completed.

The assignment requires updating the README, including three decisions. The
other seven documents are supporting material requested for this project.
The assignment and original visible tests take precedence over proposed choices.
Update related documents together when a decision changes.

## Database choice

Use **Cloudflare D1 with SQLite SQL semantics**. It is explicitly required by
the assignment, and it fits the four-table relational model:

- Foreign keys connect homes, members, bills, and shares safely.
- Named checks and unique constraints reject invalid or duplicate stored rows.
- Atomic batches create a bill with all shares, avoiding partial records.
- Conditional updates plus stored keys protect payment transitions and retries.
- The Worker accesses D1 through `env.DB`, matching the required environment.

D1 is Cloudflare's managed SQL service; it is not a separate PostgreSQL or MySQL
deployment. See the [official overview](https://developers.cloudflare.com/d1/).
Selection rationale, alternatives, platform trade-offs, tables, and invariants
are detailed in [DATABASE-DESIGN.md](DATABASE-DESIGN.md).

## Installed dependency baseline

Source: [DoCoDeGo assignment template](https://github.com/DoCoDeGo-Engineering/sde-intern-task-002).
The original manifests, workspace settings, and lockfile were imported without
upgrading dependencies. Installation used Node.js 24.14.0 and pnpm 11.18.0.

Verified on November 3, 2026:

- `pnpm install --frozen-lockfile`: succeeded; original lockfile preserved.
- `pnpm -r list --depth 0`: confirmed 17 direct packages across three projects.
- Tool launch checks: Vite 8.3.5, Vitest 5.0.5, TypeScript 7.0.2, Biome 2.6.4.
- `pnpm --filter bill-splitter-api cf-typegen`: succeeded with Wrangler 4.156.0;
  generated `api/worker-configuration.d.ts` for the D1 binding.

Core runtime dependencies include Hono 4.13.14, React/React DOM 19.3.1, and
TanStack Router 1.170.46. Workers tests use the template's
`@cloudflare/vitest-plugin` 1.4.11, not the older pool package.

## Backend verification

Verified on 3 November and rechecked on 4 November 2026:

| Check                     | Result                                                    |
| ------------------------- | --------------------------------------------------------- |
| `pnpm test:web`           | Run 74 frontend client regressions with Node 24           |
| `pnpm test`               | 77 tests passed: 24 original and 53 additional tests      |
| `pnpm check`              | Passed across the workspace                               |
| `pnpm typecheck`          | Passed across both packages                               |
| Local D1 migration        | `0001_init.sql` applied successfully                      |
| Local API smoke test      | Health returned 200; missing-home reads returned JSON 404 |
| Original tests and helper | Preserved unchanged from the supplied template            |
| Frontend production build | Passed: `pnpm build`                                      |

Tests cover exact splits, invalid input, zero-cent shares, membership snapshots,
concurrent payments, same-key replay, cross-home references, transaction rollback,
and safe balance arithmetic. Supporting home/member and bill reads are implemented.
The audit adds exact raw-number validation, consistent bill reads, concurrent
bill creation, home isolation, and independent BigInt split-boundary checks.

The machine ran out of memory when native checks ran together. Tests now use
one worker; package type checks use the compiler's single-threaded mode and run
sequentially. Request-race tests still issue concurrent API calls.

The latest backend suite on 4 November 2026 passes all 77 tests, including three
cache-policy regressions. Frontend recovery and boundary checks now total 72.
Earlier repeat attempts exhausted system virtual memory; the frontend guide
retains direct commands for machines under memory pressure.

The earlier smoke-test server was stopped after verification; development
services were subsequently restarted at the user’s request. No remote database or
Cloudflare deployment was changed. Rendered frontend acceptance remains separate
from build, type, and logic verification.

## Frontend verification

Verified on 3 November and rechecked on 4 November 2026:

| Check                       | Result                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pnpm build`                | Passed; production assets and route tree generated                                                                     |
| `pnpm test:web`             | 74 client regression tests passed using Node 24                                                                        |
| `pnpm typecheck`            | Both packages passed                                                                                                   |
| Local web/proxy smoke       | Root, nested route, transformed page module, and proxied health returned 200                                           |
| Real client/API integration | Exact splits, payment replay, conflict, reload, membership snapshot, and balances verified                             |
| Browser acceptance          | Incomplete: browser host unavailable; native Brave access timed out at app approval; rendered checks remain unobserved |

See [web/FRONTEND.md](web/FRONTEND.md) for the file map, data flow, recovery
behavior, design plan, and acceptance evidence. The local integration created a
separate QA home (`cfa8f0ac-16d9-445e-a005-6338a51af4a5`); existing homes were
not modified. Earlier verification servers were stopped afterward; the
development services have since been restarted.

## Backend audit and remaining limits

The earlier backend audit added 30 regression tests. Nine initially failed; all now pass after
the fixes. The original 24 assignment tests and 20 earlier edge-case tests also
passed, for 74 tests at that stage. The current audit adds three cache-policy
cases, bringing the backend suite to 77; see [AUDIT.md](AUDIT.md).

| Finding                                                                             | Resolution                                                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| JSON parsing could round a fractional amount into an accepted integer               | Validate the original numeric literal using the native JSON reviver source before accepting its parsed value |
| Separate bill/share reads could combine different database moments                  | Read headers and shares in one joined SQL snapshot                                                           |
| Missing shares or a mismatched share sum could appear as a successful bill response | Report an internal data-integrity failure instead of returning misleading financial data                     |
| A payment success type still allowed a null timestamp                               | Use `PaidShare` with a required timestamp and an explicit invariant check                                    |

The stored-data guards cover unexpected inconsistent rows, such as manual SQL
changes. Atomic bill creation already prevents partial inserts through the API.
No schema, dependency version, or supplied test was changed during this audit.

Remaining boundaries to account for:

- Only share payment is idempotent by assignment contract. Retrying home, member,
  or bill creation can create another record. Do not silently retry bill creation
  in a form or deduplicate by title/amount, since identical bills can be valid.
- A combined outstanding balance beyond the safe numeric range returns an explicit
  JSON 500 error. Individual bills remain readable and can be paid to reduce it.
- History reads load all of one home's bills/shares. Pagination is a future scaling
  decision if this small household app grows.
- Authentication, member permissions, and actual money transfers are outside the
  assignment scope. They are required product decisions for a broader service.

## Setup in the assignment template

The verified local baseline is Node.js 24.14.0 and pnpm 11.18.0. Run commands
from `C:\Users\sksin\OneDrive\Desktop\splito`.

To reproduce the dependency installation:

```sh
pnpm install --frozen-lockfile
```

Start the implemented backend, including local migrations, with:

```sh
pnpm --filter bill-splitter-api dev
```

Start the frontend and API together from the Splito root:

```sh
pnpm dev
```

If concurrent wrapper processes exhaust this machine's memory, the frontend guide
includes the two direct dev commands that were verified successfully.

Expected template development addresses:

- Web: http://localhost:5173
- API: http://localhost:8787
- Health: http://localhost:8787/api/health returns `{ "status": "ok" }`.

The supplied `pnpm dev` applies SQL migrations locally before starting the API.
If pnpm reports ignored build scripts, run `pnpm approve-builds` and allow
`esbuild` and `workerd` as directed by the assignment.

## Commands

| Command                                      | Purpose                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                                   | Run API and frontend together; apply local migrations before the API starts |
| `pnpm test`                                  | Run the API test suite in the Workers runtime                               |
| `pnpm check`                                 | Check formatting, lint rules, and imports with Biome                        |
| `pnpm check:fix`                             | Apply available automatic Biome fixes                                       |
| `pnpm typecheck`                             | Run TypeScript checks in both packages                                      |
| `pnpm build`                                 | Create the frontend production build                                        |
| `pnpm --filter bill-splitter-api cf-typegen` | Regenerate Cloudflare environment types                                     |

The original template commands remain available; `test:web` adds client regressions
without new dependencies. Type checks run sequentially to bound memory use.

After changing `api/wrangler.jsonc`, refresh the generated environment types:

```sh
pnpm --filter bill-splitter-api cf-typegen
```

Evaluator command:

```sh
pnpm install && pnpm check && pnpm typecheck && pnpm test
```

## Decisions

These three decisions are implemented in the backend:

1. **Validate money as safe integer cents and check accumulated balances.**
   Integer cents are required; original numeric literals and safe-range checks
   prevent silent rounding when parsing totals or combining many bills.
2. **Store member order explicitly in the database.** A generated ordinal makes
   extra-cent distribution and balance ordering deterministic, including when
   members have identical names or timestamps.
3. **Make the database own the payment transition.** A conditional update stores
   the key and timestamp only while the share is unpaid. This protects concurrent
   requests and makes same-key retries return the original payment result.

## Verification and submission

Backend and frontend build/logic checks above pass. Rendered browser acceptance
and final submission are pending.
The supplied tests and `api/test/helpers.ts` remain unchanged. See
[TODO.md](TODO.md) for the remaining work.

Keep evidence separate: documentation checks confirm that these files are
well-formed and linked; only the actual runtime and quality commands can confirm
that the implemented application works. Do not mark unrun checks as passing.

Before submitting, publish the template-based repository, pass the required
checks, record a viewable video no longer than three minutes, and disclose AI
usage in the application form. Repository and video URLs have not been supplied.

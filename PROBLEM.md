# Splito: Problem Statement

> Status: Problem definition; backend and frontend implemented, browser acceptance pending.
>
> Updated: 3 November 2026.

## Purpose

Explain why Splito exists and what a successful solution must achieve. Product
flows belong in [PRD.md](PRD.md); testable obligations belong in
[REQUIREMENTS.md](REQUIREMENTS.md).

## Problem

People sharing a home need to divide household bills fairly and know which
shares remain unpaid. Manual calculations and informal payment records can
cause rounding mistakes, duplicate payment records, and unclear balances.

Splito will create a home, register its members, divide each bill among them,
and record payment of each member's share.

## Worked example

Alice, Bob, and Charlie join a home in that order. An electricity bill costs
1,000 cents. The split is:

| Member  | Addition order | Share     | Status after Bob pays |
| ------- | -------------- | --------- | --------------------- |
| Alice   | First          | 334 cents | Unpaid                |
| Bob     | Second         | 333 cents | Paid                  |
| Charlie | Third          | 333 cents | Unpaid                |

Alice receives the extra cent because she joined first. The three shares add
up to exactly 1,000 cents.

After Bob pays, his share has a payment timestamp and contributes zero to his
outstanding balance. Repeating that payment request must not record another
payment or change the timestamp.

Before payment, the household owes 1,000 cents in total. After Bob's payment,
667 cents remain outstanding: Alice's 334 plus Charlie's 333. The original bill
total stays 1,000 cents; payments change outstanding amounts, not the bill.

## Users and needs

| User                       | Need                                               |
| -------------------------- | -------------------------------------------------- |
| Person organizing the home | Create the home and add members through the API    |
| Person recording a bill    | Enter a title and total and receive an exact split |
| Household member           | View shares and mark a share as paid               |
| Anyone viewing the home    | Understand paid status and outstanding amounts     |

These are usage roles, not authenticated permission levels. Authentication is
outside the assignment's scope.

## Terms

| Term                | Meaning                                               |
| ------------------- | ----------------------------------------------------- |
| Home                | The household that contains members and bills         |
| Member              | A person registered in one home                       |
| Bill                | A titled expense with a fixed total in cents          |
| Share               | One member's fixed portion of one bill                |
| Payment             | Recording a share as paid; it does not move money     |
| Outstanding balance | Sum of a member's unpaid shares in a home             |
| Idempotency key     | Request value used to recognize retries for one share |

## Required outcome

- Each bill is split among the home's members at creation time.
- All money is represented as integer cents.
- Remainders follow member insertion order.
- Each share can transition to paid only once.
- Repeated requests and concurrent requests preserve correct data.
- The page handles loading, empty results, and API errors without crashing.
- The supplied tests, formatting checks, and type checks pass.

## Problems the implementation must prevent

| Failure                                     | Required protection                                |
| ------------------------------------------- | -------------------------------------------------- |
| Rounding creates missing or extra money     | Integer-cent arithmetic and remainder distribution |
| A bill is saved with only some shares       | Atomic bill/share creation                         |
| A retry records payment again               | Store and compare the accepted idempotency key     |
| Concurrent requests overwrite payment       | Conditional database update                        |
| A member or share references unrelated data | Foreign keys and bill/share relationship checks    |
| API errors make the page unusable           | Explicit frontend loading and failure handling     |

## Boundaries

Payment means recording payment status; no money is transferred. The initial
scope excludes authentication, payment gateways, custom split percentages,
multiple currencies, recurring bills, notifications, and editing or deleting
financial history.

## Source and related documents

The source is the supplied **SDE Intern Assignment: Shared Bill Splitter**,
available in the [original template repository](https://github.com/DoCoDeGo-Engineering/sde-intern-task-002).
See the [documentation rules](README.md#documentation-rules) for the distinction
between assignment requirements and proposed design choices.

- [Product scope](PRD.md)
- [Verifiable requirements](REQUIREMENTS.md)
- [Implementation checklist](TODO.md)

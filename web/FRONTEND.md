# Splito frontend

Updated: 4 November 2026. The app has separate Overview, Shared bills, and Housemates routes. Build, types, client logic, and server-rendered route/content regressions pass. Actual browser visual acceptance remains incomplete because browser access is unavailable.

## Run locally

From `C:\Users\sksin\OneDrive\Desktop\splito`:

```sh
pnpm dev
```

Open http://localhost:5173. Create a home or open a remembered home. The optional sample action explicitly creates a separate household; nothing is seeded automatically.

If this machine runs low on memory, apply local migrations and start the API and web in separate terminals:

```sh
# From splito/api
pnpm exec wrangler d1 migrations apply DB --local
node --max-old-space-size=256 node_modules/wrangler/bin/wrangler.js dev --ip 127.0.0.1 --port 8787
```

```sh
# From splito/web
node --max-old-space-size=192 node_modules/vite/bin/vite.js --host 127.0.0.1
```

A lower-memory production build, also from `splito/web`:

```sh
node --max-old-space-size=96 --max-semi-space-size=1 node_modules/vite/bin/vite.js build
```

## Pages and navigation

| URL                         | Purpose      | Content                                                                |
| --------------------------- | ------------ | ---------------------------------------------------------------------- |
| `/`                         | Home setup   | Create/open a home, remembered homes, optional sample household        |
| `/homes/:homeId`            | Overview     | One outstanding balance and three small supporting metrics             |
| `/homes/:homeId/bills`      | Shared bills | Search, filters, bill cards, persisted shares, payment controls        |
| `/homes/:homeId/housemates` | Housemates   | Member directory, individual balances, share counts, add-member action |

Navigation uses real TanStack Router links. Exactly one section is active. Each route has its own heading, browser title, loading/empty/error presentation, and relevant primary action. The shared shell omits redundant breadcrumbs and page subtitles. Overview does not render bill cards, payment rows, or the member directory.

The application remains one React SPA. The Shared bills route meets the assignment's requirement to display one home's bills and shares together on a page; the additional pages organize the surrounding management work.

## Shared state and recovery

`HomeLayout.tsx` owns the household request state, payment attempts, confirmations, and creation dialogs. The parent route stays mounted while navigating between its children. Switching sections therefore does not cancel a payment or create a separate balance snapshot. Switching to another household remounts the parent and cancels obsolete requests.

- Home details and bills load in parallel. Member-name mismatches trigger one additional read, then an explicit error if relationships remain inconsistent.
- `ledger.ts` derives every page's figures from the same persisted bill shares. BigInt preserves exact accumulated amounts. Existing splits are never redistributed in the client.
- Payment keys survive same-tab reloads when session storage is available; memory is the fallback. A lost response reuses the same key. A 409 offers status refresh.
- A share becomes paid only after a validated payment response or confirmed read. Locally confirmed payments are merged into refresh results so an older GET cannot restore an unpaid state.
- Requests time out after 15 seconds. Abort/timeout does not prove a server write was canceled.
- Confirmed bill/member creation stays locked until the following refresh succeeds. A failed refresh offers a read-only retry; closing the dialog leaves the existing page’s stale-data warning. Creation forms never retry automatically. Uncertain member/bill writes block resubmission and offer a fresh read. Partial sample creation retains a link to the saved home.
- Zero-cent shares still require explicit payment status. A member with no historical shares has a zero balance and a separate “No bill shares” label.
- Route changes move focus to the new page heading unless a dialog is open. Dialog cleanup returns focus to its original control or the current page heading if that control no longer exists. Actual keyboard behaviour still requires browser verification.
- Names/titles render as React text; IDs are URL-encoded. Browser storage is optional.
- Amounts follow the assignment’s dollar/cents definition: dollar input and `$` displays, integer cents in requests/storage. Categories, bill dates, signed-in user, permissions, and money transfers are not invented. Anyone with a home URL can read/update it under the assignment's unauthenticated scope.

## File map

| File                                                  | Responsibility                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/main.tsx`, `src/router.tsx`                      | React entry and typed TanStack Router                                          |
| `src/routes/__root.tsx`, `index.tsx`                  | Root recovery and setup route                                                  |
| `src/routes/homes.$homeId.tsx`                        | Persistent household parent route                                              |
| `src/routes/homes.$homeId.index.tsx`                  | Overview child route                                                           |
| `src/routes/homes.$homeId.bills.tsx`                  | Shared bills child route                                                       |
| `src/routes/homes.$homeId.housemates.tsx`             | Housemates child route                                                         |
| `src/routeTree.gen.ts`                                | Generated route tree; do not edit                                              |
| `src/components/HomeLayout.tsx`                       | Shared shell, active navigation, dialogs, request owner                        |
| `src/components/HomePageHeader.tsx`                   | Page heading, refresh control, loading/retry presentation                      |
| `src/components/OverviewPage.tsx`                     | Outstanding balance and three supporting metrics                               |
| `src/components/BillsPage.tsx`                        | Bill list/search/filter/payment workflow                                       |
| `src/components/HousematesPage.tsx`                   | Responsive member table and balances                                           |
| `src/components/StartPage.tsx`                        | Create/open homes and optional sample setup                                    |
| `src/components/BillCard.tsx`, `ShareRow.tsx`         | Native bill disclosure, persisted shares, recorded dates, and payment controls |
| `src/components/MutationDialog.tsx`, `Modal.tsx`      | Creation forms, native dialogs, recovery                                       |
| `src/components/Icon.tsx`          | SVG icons, identity, initials                                |
| `src/components/PageState.tsx`                        | Reusable loading/empty/retry state                                             |
| `src/lib/home-context.tsx`                            | Typed shared state consumed by child pages                                     |
| `src/lib/use-home.ts`                                 | Ordered requests, cancellation, payments, reconciliation                       |
| `src/lib/ledger.ts`, `money.ts`                       | Exact shared summaries and decimal parsing/formatting                          |
| `src/lib/api.ts`, `payment-attempts.ts`, `storage.ts` | Typed HTTP/runtime guards, retry keys, remembered homes                        |
| `src/styles.css`                                      | Responsive shared shell and distinct page layouts                              |
| `tests/client.test.mjs`                               | 34 API-client/money/storage regressions                                        |
| `tests/ledger.test.mjs`                               | 3 shared-summary integrity regressions                                         |
| `tests/routes.test.mjs`                               | 9 route/content/disclosure regressions                                         |

The old combined `HomePage.tsx` was removed. No runtime dependencies were added. The generated route tree retains TanStack's upstream type assertions; application source has no explicit `any`.

New audit coverage adds `tests/audit.test.mjs` (22 boundary/storage/cache cases)
and `tests/creation-attempt.test.mjs` (four confirmed-save recovery cases). The
current suite has 72 tests; the earlier counts below document prior checkpoints.
See [the full audit](../AUDIT.md).

## Host inspection

| Concern      | Evidence                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | React 19.3.1 and Vite 8.3.5 — `package.json`                                                                                                      |
| Routes       | TanStack file plugin and nested home routes — `vite.config.ts`, `src/routes/`, `src/router.tsx`                                                   |
| Components   | Existing bill/form components reused; separate pages — `src/components/HomeLayout.tsx`, `BillsPage.tsx`, `HousematesPage.tsx`, `OverviewPage.tsx` |
| Tokens/theme | Dark green/teal CSS variables with a fixed dark color scheme — `src/styles.css`, `index.html`                                                 |
| Tailwind     | Absent — `package.json`, `vite.config.ts`                                                                                                         |
| Dependencies | Existing React/React DOM/TanStack Router only — `package.json`                                                                                    |

## Page plan

Job: manage household expenses through separate task pages. Archetype: product workspace. Primary state boundary: current route → selected page with matching navigation/title/focus. Payments retain ready → pending → confirmed or error/retry state in the shared parent.

| Region         | Purpose                                 | Published Registry component | State/motion                             |
| -------------- | --------------------------------------- | ---------------------------- | ---------------------------------------- |
| Shared layout  | Household context and navigation        | none                         | Selected route and heading focus         |
| Overview       | Outstanding balance and three metrics   | none                         | Confirmed aggregate data                 |
| Shared bills   | Search, inspect splits, record payments | none                         | Pending/success/error/retry              |
| Housemates     | Responsive member table and balances    | none                         | Add-member flow                          |
| Shared dialogs | Create records and recover              | none                         | Validation, pending, error, focus return |

Registry: none; semantic React and CSS, no Registry source/dependencies/runtime installed. The primary local interaction is native bill disclosure (closed to expanded); pending/error state remains visible when closed. Expansion is static in both motion preferences. Keep the existing 24px SVG outline grid, matching logo/favicon, and text-plus-icon payment tags. Decorative sparkles and repeated promotional footer branding remain removed.

Responsive plan: 320/390px stack content with fixed bottom navigation; 768px uses a compact header and bottom navigation; 1440px uses a 240px sidebar with a balance band, compact bill ledger, and member table. Dark is the only theme, with semantic tokens applied from the first paint. Data surfaces remain opaque; only dialog backdrops use blur. Controls retain 44px CSS minima, with explicit control-border tokens.

## Verification evidence - 4 November 2026

| Check                   | Observed evidence                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build                   | `pnpm build`: exit 0; nested routes and separate route chunks generated                                                                                                                                             |
| Types                   | `pnpm typecheck`: exit 0 in both packages                                                                                                                                                                           |
| Lint                    | Biome checks pass after formatting                                                                                                                                                                                  |
| Frontend regressions    | `pnpm test:web`: 46 passed — 34 client, 3 shared-ledger, 9 route/content                                                                                                                                            |
| Route/content rendering | Actual TSX rendered with React DOM Server: each direct URL has its own heading and one active nav link; populated Overview excludes bill/member lists; Bills and Housemates contain only their respective workflows |
| Live routes             | Overview, Bills, Housemates, and API health checked through the running Vite server                                                                                                                                 |
| Backend verification    | `pnpm test`: all 74 tests passed after the reference-driven redesign                                                                                                                                                |
| 320px                   | Incomplete: viewport/document widths, minimum target geometry, and offenders unmeasured                                                                                                                             |
| 390px                   | Incomplete: viewport/document widths, minimum target geometry, and offenders unmeasured                                                                                                                             |
| 768px                   | Incomplete: viewport/document widths, minimum target geometry, and offenders unmeasured                                                                                                                             |
| 1440px                  | Incomplete: viewport/document widths, minimum target geometry, and offenders unmeasured                                                                                                                             |
| Dark theme              | Dark-only palette implemented; actual rendered theme inspection incomplete                                                                                                                                                            |
| Keyboard/focus          | Heading handoff/dialog return implemented; actual key path and focus return unobserved                                                                                                                              |
| Reduced motion          | Implemented; browser preference emulation unobserved                                                                                                                                                                |
| Targets                 | CSS minima 44px; rendered minimum width/height and offenders unmeasured                                                                                                                                             |
| Primary state           | Client/API success, error, timeout, replay, and abort checked; route/content rendering checked; rendered pending/retry/interruption states incomplete                                                               |
| Runtime                 | Server-rendering tests pass; browser console/page/request/hydration counts unobserved                                                                                                                               |

Browser access still reports “The browser access host is unavailable.” The earlier native Brave attempt timed out at app approval. Server rendering and HTTP checks verify route/content behaviour, not painted geometry, browser focus, or screenshots. Complete the browser checks before claiming full visual acceptance.

## Applied design reference - 4 November 2026

The user-supplied Shared Bill design direction is implemented as a minimal finance workspace. The palette uses canvas `#F5F7F6`, surface `#FFFFFF`, text `#17231F`, brand `#176B57`, and structural border `#E3EAE6`. Green indicates confirmed payment outcomes, amber indicates unpaid records, and blue identifies partially paid bills. Labels and icons accompany status colours.

Inter (400/500/600) is used for records, amounts, forms, and tables; Poppins 600 is reserved for headings. Latin WOFF2 assets are hosted locally in `public/fonts/`, with `font-display: swap` and an Inter preload. Two font binaries total 56,256 bytes. Licensing/source files are included alongside them: [Inter license](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt), [Poppins license](https://github.com/google/fonts/blob/main/ofl/poppins/OFL.txt). The running app does not request fonts from a third-party server.

Overview prioritises one outstanding balance and three supporting metrics, without a progress panel or duplicate destination links. Shared bills uses one ledger surface: native expandable rows, all bills closed initially, and split/payment subtrees rendered only when expanded. Pending/error feedback remains visible even while a row is closed. The Housemates page uses a comparison table, with essential balances and unpaid counts kept readable on mobile. Separate routes and shared parent-owned request/payment state remain intact.

Decorative cards, repeated tinted icon boxes, rainbow member colours, oversized corner radii, floating bubbles, and per-bill decorative progress bars are removed. Structural surfaces use 10px radii, controls 6px, and dialogs 12px. Inputs/secondary buttons have stronger control-border tokens. Only the modal backdrop has glass-like blur; money records stay on solid surfaces.

The backend contract remains authoritative. The interface does not invent payers, personal net debts, currency selection, due dates, overdue status, categories, or custom split modes absent from that contract. Stored `paidAt` values provide the displayed payment-record dates. Exact-cent parsing, member-order rounding, idempotency keys, late-response protection, and database constraints are preserved. All 74 backend tests pass after this redesign.

No applicable disclosure recommendation was found in the local UI catalog after the permitted retry; the implementation uses native HTML details/summary semantics with static expansion as the fallback. Browser layout measurements and actual keyboard/theme/reduced-motion checks remain unobserved because the browser host is unavailable.

Final reference-pass checks: build, workspace lint, both package type checks, 74 backend tests, and 46 frontend tests pass. Checked text colour pairs have a minimum calculated contrast of 4.66:1 in light and 6.73:1 in dark; control outlines measure 3.17:1 and 4.26:1 against their surfaces. Both local font files and new page modules return HTTP 200. These colour/source checks do not establish full WCAG or painted-layout acceptance; browser viewport geometry, focus, and runtime counts remain unobserved.

## Clutter reduction - 4 November 2026

Overview now contains only the outstanding balance and three supporting metrics. The payment-progress panel, duplicate workspace navigation, repeated amount summaries, and explanatory copy were removed. The page uses open spacing rather than multiple bordered panels.

Shared bills starts with every bill closed. Payment rows render when a bill is opened; pending/error feedback still appears in closed summaries. The first screen omits repeated result counts and per-bill icons. A new regression confirms that an opened bill still exposes its member shares and payment controls.

Housemates uses three desktop columns: Member, Outstanding balance, and Status. Share-count metadata stays under each member's name. Repeated count columns and the permanent membership explanation were removed; the add-member form retains its relevant guidance.

The shared shell has no desktop top bar or duplicated navigation counts. Theme, refresh, and sharing controls sit in a quiet sidebar footer, with a compact utility group in the mobile header. The earlier clutter pass reduced the start page to a form/household list. The fuller welcome layout has since been restored at the user’s request; joining by ID and sample setup remain available in the household panel.

Backend and payment request logic was not modified by this visual cleanup. Browser visual acceptance remains unobserved because the browser service is unavailable; route/content/payment rendering regressions provide structural checks.

## Welcome page restored - 4 November 2026

The user preferred the fuller landing page. The compact form-only presentation
was an overextension of the dashboard clutter cleanup. The welcome route now
includes a large introductory hero, a household setup/recent-households panel,
and a three-step explanation with the existing professional outline icons.
The existing green palette, locally hosted Inter/Poppins, and light/dark tokens
are retained. At narrow widths the hero, setup panel, and steps stack vertically.
There are no invented customer counts, payer details, or decorative floating cards.

Create/open/sample actions and their request/recovery logic are unchanged.
The hero remains present for first-time and returning visitors. Two server-rendered
regressions check those cases and the navigation destinations; the frontend suite
now totals 74 cases, including 11 route/content cases. The backend was not changed.
Actual visual/keyboard inspection remains pending: the browser host again reported
unavailable when preview was attempted after restoration.

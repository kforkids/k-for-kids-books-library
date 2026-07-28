# Reservation Flow Performance Analysis

**Scope:** `reserveBookForCustomer(bookNo, customerToken)` in `app-script/Code.gs` (the logged-in customer reservation path). The same issues apply to `reserveBook`, `unreserveMyBook`, `getMyReservations`, etc.

**Symptom:** A single reservation takes **3+ seconds**.

**Status:** Round 22 — customer-linked issuing (Issued Customer ID / Issued At / Due Date), "issued to me" + overdue. Runtime confirmation pending.

---

## Round 22 — issue books to a customer (linked), with due date + overdue

Part 2 of the stats-strip work. Books are now issued to a specific customer (by id), not a free-text name.

**Sheet (add manually to Books-DB):** `Issued Customer ID`, `Issued At`, `Due Date`.

**Server (`Code.gs`):**
- `getBookIssueColumns_` resolves the three columns by header name.
- `issueBook(bookNo, customerId, customerName, adminCredential)` — writes Issued to (name) + Issued Customer ID + Issued At (now) + Due Date (now + 15 days = `LOAN_DAYS`), sets Issued, clears the reservation link. If the book was reserved by a **different** customer, that reservation is consumed/cancelled and the reserver's count decremented.
- `returnBook` clears the three issue columns too.
- `getBooks` exposes, per row: to admin → full issue details; to the **borrower** → `isMyIssue`, `dueDate`, `overdue`; never to other customers. `overdue` = due date < now.

**Client (`Index.html`):**
- **Issue modal** — free-text name replaced with a searchable **customer picker** (from `getCustomers`). If the book is reserved, the reserver is preselected with a note; picking a **different** customer flips the button to "Cancel reservation & issue" and triggers a confirm before issuing. Manual issue-date input removed (auto today + 15-day due).
- **Book detail** — Issued shows: admin → issued-to/at/due + Overdue badge; owner → "You've borrowed this book" + due + Overdue; others → generic.
- **Stats strip** — the customer's "issued to me" count (from Part 1) is now real via `isMyIssue`.

Verified in-browser: picker populate/preselect/search, same-vs-different-customer button + confirm, and the admin/owner/other Issued detail rendering (incl. overdue).

---

## Round 21 — chips + filter panel (declutter the filters)

**Problem:** the four filter groups (Language / Age / Status / Has-image) rendered as pill rows that wrapped onto 3–4 lines on mobile — cluttered, ate ~half the screen.

**Fix (client only, `Index.html`):**
- **Active-filter chips** under the search bar — each active filter shows as a removable chip (e.g. `Marathi ✕`, `Available ✕`, `Has image ✕`) plus a `Clear all` when >1. Always visible, even when the filter panel is collapsed, so the user always sees and can one-tap-remove what's applied. This is the main "wow."
- **Filter panel** — the existing collapsible `#filterBarEl` gained a header (title + Clear all) and a green **"Show N books"** apply button whose count updates live as filters change.
- Default view is now: search + Filters button + any chips. On mobile the panel stays collapsed by default (round 19), so filters no longer dominate the screen.

New JS: `renderFilterChips`, `filterChipLabel_`, `setFilterValue_` (programmatic pill sync), `removeFilter`, `clearAllFilters`, `updateFilterResultCount_`; all driven from `applyFilters`. Verified in-browser: chips render/remove correctly and stay visible while the panel is collapsed.

---

## Round 20 — one login form; admin via username+password; invite behind a link

Follow-up to round 19: the auth modal's tabs (Login / Join / Admin) were removed.

- **One Login form for everyone.** Admin now logs in through the same email/phone-or-username + password form. New server `login(identifier, password)` checks admin credentials first (new `ADMIN_USERNAME` script property + existing `ADMIN_PASSWORD`) and returns `role: 'admin'`; otherwise it falls through to `loginCustomer` and returns `role: 'customer'`. The client (`doLogin`) enters admin or customer mode based on the role. The Admin tab is gone — nothing advertises admin, but auth is still fully server-verified + rate-limited.
- **Invite code behind a link.** The "Join with Invite Code" tab became a small "Have an invite code?" link that reveals the claim form (with "← Back to login"). Cleaner default view; new customers still reach it.
- Removed the client `loginAdmin`/`loginCustomer` wrappers and the tab-label listener; `openCustomerAuth` resets to the login pane.

**Setup note:** add an `ADMIN_USERNAME` script property (Project Settings → Script Properties) alongside `ADMIN_PASSWORD`. The old server `loginAdmin(password)` is left in place but unused.

---

## Round 19 — one login experience + Remember me

**Problem:** two separate login paths — customers used a modal, admins used a separate yellow inline bar. Also no way to remember the username.

**Fix (client only, `Index.html`):**
- **One modal, one entry point.** Removed the separate admin bar and the header shield button. The single "Login" button opens the auth modal, now with three tabs: **Login** (email/phone), **Join with Invite Code**, and **Admin** (password). `submitCustomerAuth` routes by active tab; the footer button label follows the tab (Login / Join / Login as admin). Admin login closes the modal and shows the Admin Mode badge (moved to the header).
- **Remember me.** A checkbox on the Login tab saves only the **username** (email/phone) to `localStorage` (`kfkRememberedUser`) and prefills it next visit; unchecking forgets it. The password is intentionally NOT stored — the login fields are wrapped in a `<form>` with proper `autocomplete`, so the browser's own password manager handles saving/autofilling the password securely.
- **Unified logout.** One `logoutEveryone()` signs out of whichever session(s) are active; `renderCustomerState` now toggles Login/Logout for admin OR customer sessions.

No server change — `loginAdmin`/`loginCustomer` are unchanged.

---

## Round 18 — admin action feedback + book visibility

Three changes:

1. **Admin cancel/return now use the banner** (like the customer flow). `runAdminAction_` shows a `pending` banner during the call, then `✓ …` success or a red error — instead of a fleeting toast.
2. **In-progress banner is light yellow.** `.ab-pending` changed from dark slate to `#fff3cd` with dark-amber text (and matching close-button colors) so "in progress" reads as a distinct, softer state.
3. **Admins no longer see "Reserve This Book"** (it wrongly opened the login modal). The reserve button is now gated to non-admins. Instead, admins get a **Hide from users / Show to users** action:
   - Server: new `Visibility` column on Books-DB (`VISIBILITY_HEADER`), `getBookVisibilityColumn_` / `ensureBookVisibilityColumn_` / `isBookHidden_` helpers, and `setBookVisibility(bookNo, visible, adminCredential)`. `getBooks` skips `Hidden` books for non-admins and exposes `hidden` (admin-only). Hidden books stay out of the public cache (built with `isAdmin=false`).
   - Client: hide/unhide button in the Admin Actions panel, a grey **Hidden** badge + dashed outline on hidden cards (admin view only), and a "hidden from end users" note. Uses the banner for feedback.

Reversible and admin-only: end users and customers never see hidden books in the list or search; admins always can, and can unhide.

---

## Round 17 — detail-rich admin confirm dialog

**Problem:** the admin Cancel-reservation / Mark-as-returned confirm was generic ("Cancel this reservation?") — the admin couldn't verify *which* reservation/book they were about to act on.

**Fix (client only, `Index.html`):** the confirm modal now supports a rich HTML body (`confirmAction` gains `opts.bodyHtml`), and `buildAdminConfirmBody_` renders a **large 90×120 book cover** plus title, author · language, book number, and:
- Cancel reservation → *Reserved by <name>* · *Reserved on <date>* + "This frees the book and removes it from their reservations."
- Mark as returned → *Issued to <name>* + "This marks the book returned and makes it available again."

Kept the confirm step (destructive, affects another customer) rather than removing it — now it's a real verification. Details come from the admin-only fields already on `allBooks`. `.confirm-cover` CSS added; image has a placeholder fallback.

---

## Round 16 — admin cancel/return/issue left stale reservation link fields (data-integrity bug)

**Symptom:** a row showed `Status = Available` but still had `Reservation ID`, `Reserved Customer ID/Name`, `Reserved At` populated → the customer saw no reservation (the app keys "my reservations" off `Status === 'Reserved'`), and their active-count was left stale-high.

**Cause:** admin `cancelReservation` (and `returnBook`, `issueBook`) only changed `Status`/`Issued to` and **never cleared the reservation link columns**, nor decremented the reserver's count. Pre-existing bug in the admin paths.

**Fix (`Code.gs`):** all three now, in one row write, clear `Reservation ID / Reserved Customer ID / Reserved Customer Name / Reserved At`, stamp `Reservation Updated At`, and decrement the former reserver's `Active Reservation Count` (best-effort). Rewritten to use `findDataRowByExactValue_` + single-row read/write.

**One-time repair:** added `repairStaleReservationLinks()` — run once from the Apps Script editor. It scans Books-DB, clears link fields on any non-`Reserved` row that still carries them, and reconciles each affected customer's active count to their true reserved-row count. Fixes the existing bad row (M0002).

The affected customer's cached session self-heals on their next `getMyReservations` (rescan), so no extra action is needed there.

---

## Round 15 — custom confirm modal (no native browser dialog)

**Problem:** admin "Cancel reservation" / "Mark as returned" used `confirm()`, which renders the browser's native dialog with the jarring "An embedded page at …googleusercontent.com says" text.

**Fix (client only, `Index.html`):** added a reusable Bootstrap confirm modal (`#confirmModal`) styled like the app's other modals (green header), plus a `confirmAction(message, onConfirm, {title, confirmLabel, confirmClass})` helper. `doAdminAction` now closes the book modal, then opens the custom confirm; the action only runs on confirm. The helper clones its OK button each time to clear stale handlers, so it's safely reusable for any future destructive confirmation. No native `confirm()` remains.

---

## Round 14 — fix admin Customers ("Customer DB sheet not found")

**Problem:** the admin Customers tab errored with "Customer DB sheet not found." `getCustomers`, `addCustomer`, and `updateCustomerStatus` read the legacy fixed-column `Customer DB` sheet (via the `CUST` index constants), but the live data is in **Customer-Details** with a header-resolved schema.

**Fix (`Code.gs`):** all three now read/write `Customer-Details` via `getCustomerDetailsSheetAndColumns_` + a header-resolved column map (`getCustomerAdminColumns_`):
- `getCustomers` returns each row's Customer ID, name, date-of-start, location, address, account status, till-date-sum, and reservation limit/count.
- `updateCustomerStatus` writes the `Account Status` column by name match.
- `addCustomer` now creates a **complete** Customer-Details row — generates a Customer ID + invite code, sets defaults (`Active`, count 0, `invite_pending`, `Pending`, created-at) — reusing the migration helpers, so a newly added customer can actually claim a login. It returns `{customerId, inviteCode}`, which the admin UI shows in a persistent banner so the credentials can be shared.

Legacy `CUSTOMER_SHEET_NAME` is retained (still used by the one-time migration against the legacy spreadsheet); the `CUST` index constant is now unused.

---

## Round 13 — make "reserved by you" explicit

**Problem:** a customer viewing a book they'd reserved saw the same generic "This book is currently reserved" as everyone else, even though the Unreserve button implied ownership.

**Fix (client only, `Index.html`):** when `book.isMyReservation` is true, the modal shows a green **"You've reserved this book. Use 'Unreserve' below to cancel it."** instead of the neutral notice. Handled in both entry points:
- `openBookDetail` renders it immediately when `isMyReservation` is already set.
- `applyMyReservationToModal_` (the async `getMyReservations` hydration for books reserved in a prior session) now swaps the `#reservationInfoBox` to the green message at the same time it adds the Unreserve button — so message and button always agree.

Non-admin, non-owner users still see the generic "currently reserved"; admins still see the full reserver name/date panel from round 12.

---

## Round 12 — admin reservation details (with privacy)

**Requirement:** admins should see who reserved a book and when; other users must only see that it's reserved (no name, no date, no reservation ID).

**Server (`Code.gs`, `getBooks`):** now reads `Reserved Customer Name`, `Reserved At`, `Reservation Updated At` (display values) and includes them **only when `isAdmin`** — `reservedBy`/`reservedAt`/`reservationUpdatedAt` are `''` for everyone else. Enforced server-side (`verifyAdminCredential_` gates `isAdmin`), not just hidden in the UI.

**Privacy — no cache leak:** admins bypass the public books cache, and the shared cache is only written for the fully-public case, so reserver identity is never stored in or served from the cache.

**Client (`Index.html`, `openBookDetail`):** the admin "Currently reserved" panel now lists *Reserved by <name>*, *Reserved on <date/time>*, optional *Updated <date/time>*, and the Reservation ID. Non-admin (including a customer viewing someone else's reserved book) still shows the generic "This book is currently reserved." A customer viewing their **own** reservation still gets the Unreserve action via `isMyReservation` without needing their name echoed back.

---

## Round 11 — banner dismiss button + auto-close

**Problems:** (1) the banner's × button didn't dismiss it; (2) the banner sometimes stayed up.

**Fixes (client only, `Index.html`):**
- **× now works reliably:** the inner `<i class="bi bi-x">` icon was the click target and could swallow the event. Added `.ab-close > * { pointer-events: none }` so the click always lands on the button, wired the handler via a real `addEventListener` (with `stopPropagation`) instead of inline `onclick`, and enlarged the hit area (28px).
- **Hidden banner no longer intercepts anything:** `pointer-events: none` off-screen, `auto` only when `.show` — so a slid-up banner can't block clicks elsewhere.
- **Auto-close:** terminal banners (success/error) auto-close after **5 s** (`BANNER_AUTO_HIDE_MS`, now a named constant). `pending` banners stay until replaced by a terminal state (by design — they represent an in-progress action). The × lets the user dismiss any banner immediately.

---

## Round 10 — auto-continue a reserve that was blocked mid-action

**Problem:** if a reserve/unreserve was still saving and the user clicked "Reserve This Book" on another book, the only feedback was the top banner — the modal (where their attention was) looked unresponsive, and they had to guess to re-click.

**Fix (client only, `Index.html`):** instead of dropping the click, the reserve is **queued** and runs automatically when the in-flight action finishes:
- `openReserve`: if an action is in flight, store `queuedReserveBookNo`, set the modal's reserve button to **"⟳ Waiting…"** (on-modal feedback), and show a banner "Reserving this next — finishing your last action first…". The modal stays open.
- `endReservationAction_`: after the current action resolves, it drains `queuedReserveBookNo` and runs the reserve automatically (via a microtask so UI settles first). **No re-click needed.**
- **On prior failure:** the queued reserve proceeds anyway — it's self-validating (client limit pre-check + server check under the lock), so a failed prior action can't corrupt it; worst case it correctly lands on the limit/swap path.

Only reserve is queued (last-intent-wins if the user queues twice); unreserve/swap while busy still just show the wait banner. Flag balance re-verified. Correctness/perf unchanged.

---

## Round 9 — block overlapping actions + explain the at-limit case

**Problem:** while an optimistic reserve was still in flight (~2 s), clicking Reserve on another book did nothing obvious ("the button doesn't work"). Also, hitting the reservation limit opened the swap modal abruptly with no explanation.

**Fix (client only, `Index.html`):**
- **In-flight guard** (`reservationActionInFlight` + `beginReservationAction_` / `endReservationAction_`): every user-initiated reserve/unreserve/swap first calls `beginReservationAction_()`. If one is already running, it shows **"Please wait — finishing your last action…"** and bails. The flag is set at the entry point and cleared at every terminal resolution (success / error / limit / failure); the swap holds it across both its unreserve **and** the chained reserve; the self-heal retry keeps it set until the retry resolves. Verified: every begin has a matching end on all branches (no stuck flag).
- **Clearer at-limit message:** the limit pre-check now shows a red banner — *"You've reached your limit of N reserved books — unreserve one to reserve 'Title'."* — before opening the swap modal.

Guarded entry points: `openReserve`, `unreserveMyActiveBook`, `unreserveThenRetry`, and the post-login auto-reserve. Correctness/perf unchanged — display + input-gating only; the server is still authoritative under the lock.

---

## Round 8 — sticky action banner (visible feedback that survives scrolling)

**Problem:** reserve/unreserve confirmations were bottom-center toasts (3.5 s auto-dismiss) plus an inline card overlay — both easy to miss while scrolling, and the swap (cancel A → reserve B) barely communicated what happened.

**Fix (client only, `Index.html`):** a fixed **action banner** pinned just under the sticky header (`#actionBanner`, always visible regardless of scroll), driven by `showBanner(msg, type)` / `hideBanner()`:
- `pending` (spinner, stays up) → `success` (green ✓, 5 s auto-dismiss) or `danger` (red, 5 s); dismissible via an × button.
- **Reserve:** "Reserving “Title”…" → "✓ Reserved “Title”".
- **Unreserve:** "Cancelling “Title”…" → "✓ Cancelled “Title”".
- **Swap (limit modal):** "Cancelling “A” · reserving “B”…" → "✓ Cancelled “A” · Reserved “B”" — names **both** books (the cancelled title is threaded into the chained reserve via a `swapContext` arg).
- Errors show a red banner with the reason; when a modal takes over (`LIMIT_REACHED`) the banner is hidden.

The inline card overlay + toast paths were replaced by banner calls for these flows. Every `pending` banner has a resolving success/error in all branches (verified). Correctness/perf unchanged — display only.

---

## Round 7 — eliminate the images double-load

**Symptom:** on open, the page rendered books **without images**, then silently reloaded and showed them.

**Cause:** `getBooks` read image URLs from a cache (`getCachedImageMap_`) that returns empty when cold (after deploy or the 30-min TTL). The client's `maybeWarmImageCache` saw zero images → called `warmImageCache` (a ~1.1 s Drive scan) → then called `loadBooks()` **again** → second render with images. A two-phase design that was visible as a flash. It also poisoned the 5-min public-books cache with empty images on a cold start.

**Fix:** `getBooks` now calls `getImageMap_()` (build-if-cold) instead of `getCachedImageMap_()`, so the **first** response already contains image URLs. Removed the client `maybeWarmImageCache` warm-then-reload path (and the now-unused `imageWarmupAttempted` flag).

**Cost/benefit:** only the first request after a cold image cache pays the ~1.1 s Drive scan; the map caches for 30 min and the public-books result (now with URLs baked in) caches for 5 min, so subsequent visitors get instant, image-complete loads. Net: **one load, images present, no flash.**

---

## Round 6b — hybrid feedback on the optimistic actions

Optimistic UI made clicks feel instant, but the user had no explicit "in progress" or "confirmed" signal. Added a hybrid model (client only):

- **On click:** the card flips optimistically AND shows an inline **"Reserving…" / "Cancelling…"** overlay (`.card-saving`, a spinner over the card via `book._saving`); the modal closes. No blocking spinner — the user can keep browsing.
- **On server confirm (success):** the overlay clears and a **"✓ Book reserved." / "✓ Reservation cancelled."** toast appears (the up-front success toast was removed so the toast marks the real confirmation).
- **On error / `UNAVAILABLE` / `LIMIT_REACHED` / network failure:** the overlay clears, the card **rolls back** to its prior state, and a red error toast explains why.

Helpers: `markBookSaving_` / `clearBookSaving_` (set/clear `book._saving` and re-render); every success + failure + rollback branch clears the flag first so no stale overlay lingers.

This gives explicit in-progress + confirmed feedback while keeping the instant feel. Correctness is unchanged (server still authoritative under the lock).

---

## Round 6 — optimistic UI (hides the google.script.run transport floor)

Measured v28 confirmed the server is near the Sheets floor, but every call still pays a **~1.3–1.7 s `google.script.run` transport tax** (browser↔Google↔sandbox) that no server change can remove:

| Op | Server total | UI round-trip | Transport gap |
|----|------|------|------|
| Reserve (under limit) | ~1.8 s | ~3.5 s | ~1.7 s |
| Unreserve | ~1.3 s | ~3.0 s | ~1.7 s |
| Reserve (at-limit, warm) | ~0.7 s | ~2.0 s | ~1.3 s |

Also confirmed: `sessionUpdated` replaced `countAdjusted` (~700 ms → ~40 ms) — the round-5 count-write removal worked.

**Round-6 change (client only, `Index.html`):** reserve / unreserve / limit-modal-swap now update the UI **immediately** and run the server call in the **background**, reconciling on success and **rolling back** on failure.

- `snapshotBook_` / `restoreBook_` capture and restore a book's state for rollback.
- **Reserve:** client-side limit pre-check (`customerReservationLimit`, mirrors the server) shows the limit modal instantly when already at limit — no doomed round-trip. Otherwise the card flips to *Reserved-by-me* and the modal closes at once; a temp reservationId is swapped for the real one on success. On `UNAVAILABLE` / `LIMIT_REACHED` / failure → roll back + correct toast/modal.
- **Unreserve:** card flips to Available + modal closes instantly; rolls back on failure.
- **Limit-modal swap:** the swapped-out book shows Available instantly and the modal closes; the unreserve still commits server-side **before** the retry reserve (so the server sees the customer under limit), and the retry reserve is itself optimistic.

**Correctness unchanged:** the server remains the sole authority — it validates and writes under `LockService` with a fresh Books-DB read. Optimistic UI only changes what the screen shows *before* the server replies; a rejected reserve is always rolled back, so **no double-booking is possible**. The anonymous `reserveBook` (logged-out) path was intentionally left synchronous (rarer, form-based).

**Result:** clicks feel instant even though the underlying round-trip is still ~2 s. The transport floor is now invisible to the user rather than eliminated (it can't be eliminated on Apps Script web apps).

---

## Round 5 — the real remaining cost is "touching a sheet at all"

Measured v27 (deployed) proved row count no longer matters — the cost is fixed per-sheet-access overhead:

| Cost | ~ms | What it is |
|------|-----|------------|
| `getMasterData_` full read (1990 rows) | 1200 | one-time cold-session cache build |
| `linkColumns` | ~600–680 | **first touch of Books-DB**: openById + getSheetByName + header read |
| `bookRowRead` | ~300–400 | TextFinder index |
| **`countAdjusted`** | **~700–1055** | **opening Customer-Details (2nd spreadsheet)** just to write the count |
| `limitCheck` | **2** ✅ | Option A session cache working |

**Round-5 fix:** the count is no longer written to Customer-Details on reserve/unreserve. It's kept exact in the **session cache** (`addSessionReservation_` / `removeSessionReservation_`), and the sheet column reconciles lazily in `getMyReservations`. On a cold session the list is rebuilt from a Books-DB scan (not from that column), so a stale column is harmless.

- **Reserve:** removes ~700–1000 ms (no Customer-Details open).
- **Unreserve:** removes ~700 ms.
- **Correctness:** unchanged — the count column was never a safety gate; booking safety is the lock + fresh Books-DB read. The limit is enforced from the in-memory session count, which stays exact.

**Remaining after round 5:** ~1 open of Books-DB (~600 ms) + TextFinder (~350 ms) + platform jitter + the ~1.5 s `google.script.run` transport floor. Only optimistic UI can hide that transport floor.

---

## Round 4 — Option A: per-customer reservation index in the session cache

**Problem restated:** "list my reservations" (needed for the limit check and the at-limit modal) had no index, so it scanned all ~1990 Books-DB rows (~1.8 s). This dominated the at-limit path the user was testing.

**Fix (Option A):** the customer's active reservation list is now maintained **in their `CacheService` session** as `reservations: [{reservationId, bookNo, bookName}]`, with `activeReservationCount === reservations.length`.

- **Reserve** → `addSessionReservation_` (append). **Unreserve** → `removeSessionReservation_` (drop). Both also mirror the count to Customer-Details for durability.
- **Limit check** → reads `getSessionReservations_().length` — **zero sheet access** (~5 ms). A cold session (no cached list) scans Books-DB **once**, caches it, and every later call is a cache hit.
- **At-limit modal** → served from the cached list (returned in the `LIMIT_REACHED` response); the client also cross-checks against its own `allBooks` and can self-heal a stale count with one `getMyReservations` retry.
- **`getMyReservations`** is the single authoritative **reconcile point**: it does the one real Books-DB scan and refreshes both the session list and the durable count from truth.

New helpers in `Code.gs`: `persistSession_`, `getSessionReservations_`, `setSessionReservations_`, `addSessionReservation_`, `removeSessionReservation_`, `adjustCustomerActiveReservationCountByIdTo_`.

**Correctness (unchanged safety model):**
- Bookings are still governed **only** by `LockService` + a fresh Books-DB read on every write. The session list is a POLICY/display cache and never decides a book's availability — **no double-booking possible**.
- Worst case of a stale-low session list (customer reserved on another device): they might reserve **one** book over the limit until the next reconcile; never a double-book. Self-heals on `getMyReservations`.

**Expected:** at-limit reject and repeat reserves drop from ~1.8 s scan → **~5 ms** cache read. The only remaining scan is (a) the first reserve per cold session and (b) `getMyReservations` reconcile. Under-limit first-reserve still pays the two spreadsheet opens (~1.2 s) + transport (~1.5 s).

---

## Round 3 — measured v26 and removed the at-limit scan

Round-2 `/exec` measurement (v26), **under-limit** reserve:

| Step | Δ (this step) | Note |
|------|------|------|
| limitCheck | **20 ms** ✅ | session-cache fix worked (was ~1000 ms) |
| linkColumns | ~760 ms | first Books-DB open + header read |
| bookRowRead | ~445 ms | TextFinder over 1990 rows |
| countAdjusted | ~691 ms | opening **Customer-Details** to write the count |
| **server total** | **~2.2 s** | + ~1.5 s transport ≈ 3.7 s round-trip |

**At-limit** reserve (v26): `limitCheck` was **~1.8 s** because it scanned all 1990 rows via `getActiveReservationsForCustomer_` to build the "unreserve one" modal list. **This is the path the user kept testing**, which is why it felt unimproved.

### Round-3 change (user-approved)

1. **At-limit list is built in the BROWSER, not the server.** `reserveBookForCustomer` no longer scans Books-DB when the (cached) count is at/over the limit — it returns `LIMIT_REACHED` with just the counts. The client renders the list from `allBooks` (which already carries `isMyReservation` + `reservationId` per book). **Removes the ~1.8 s at-limit scan.**
2. **Stale-count self-heal (no false rejections).** If the server's cached count is stale-HIGH and would wrongly reject, the client notices (its own list shows it's under the limit), calls `getMyReservations` once to correct the server's cached count, then retries the reserve exactly once (`limitRetryDone` guard prevents loops).

### Correctness (unchanged safety model)

- **No double-booking, ever:** every reserve/unreserve still runs inside `LockService.getScriptLock()` and reads the book's status **fresh from the sheet inside the lock** before writing. Caches are never trusted for a book's availability.
- **The cached count is a POLICY gate only** (how many books you may hold), never a book-availability guard. Worst case of a stale-LOW count: a subscriber reserves **one** book over their limit — never a double-book. It self-corrects on next load / `getMyReservations`.
- **The client-built list is display-only.** Clicking "Unreserve" still calls the server, which re-verifies ownership + current status under the lock.

**Expected after round 3:** at-limit reject drops from ~2.4 s → well under 1 s of server work; under-limit reserve remains ~2.2 s server (dominated by two spreadsheet opens + TextFinder) unless we also defer the count write (`countAdjusted`, ~700 ms) — not yet done. The ~1.5 s `google.script.run` transport floor is unchanged (optimistic UI is the only lever; deferred).

---

## ⚠️ Measured results (deployed /exec, ~1990-row Books-DB) — corrects the earlier theory

The first round of fixes did **not** move the needle. Instrumenting the deployed build revealed the real cost breakdown per `reserveBookForCustomer` call:

| Step | Delta | Cause |
|------|-------|-------|
| `customerLookup` | **~900–1000 ms** | Opening **Customer-Details** sheet + finding the row, on every reserve |
| `ensureLinkColumns` + `masterRead(1990 rows)` | **~1000 ms** | My round-1 "read once" change read **all 1990 rows** via `getValues()` just to touch one book |
| `limitCheck` scan (at-limit only) | **~1200 ms** | `getActiveReservationsForCustomer_` scanning all 1990 rows |
| Total server | **2.2–3.1 s** | + ~1.5 s `google.script.run` transport = ~3.7 s round-trip |

**Key correction:** the earlier writeup blamed "many small RPCs." The real killers were (a) **reading ~2000 rows to find one book** — and my round-1 refactor *made this worse* by replacing the original `TextFinder` (reads 1 row) with a full `getValues()`; and (b) **opening the Customer-Details sheet on every reserve**.

### Round-2 fixes (the ones that matter)

1. **Single-book lookup via `TextFinder` again** — `reserveBook` / `reserveBookForCustomer` / `unreserveMyBook` locate the row with `findDataRowByExactValue_` and read **only that one row**, instead of `getMasterData_()`'s full ~2000-row read. Removes ~1 s.
2. **Session-cached customer, no sheet open on the hot path** — the limit check now uses `monthlyReservationLimit` + `activeReservationCount` already carried in the `CacheService` session (`verifyCustomerSession_`). Customer-Details is only touched to write the count *after* a successful reserve (`adjustCustomerActiveReservationCountById_`, a targeted `TextFinder`), and the session cache is kept in sync (`updateSessionActiveCount_`). Removes the ~1 s `customerLookup` from the hot path.
3. **At-limit path** still scans (it must, to list your reservations for the modal) but reconciles the session count so subsequent reserves are fast.

**Expected:** server ~2.2 s → **< 0.8 s** in the common (under-limit) case; the residual ~1.5 s `google.script.run` transport is a platform floor (optimistic UI is the only lever for that, deferred by user).

> Instrumentation (`[PERF ...]` logs in `Code.gs` + a `console.log` round-trip timer in `Index.html`) is still in place for the re-test. Remove once confirmed.

---

**Earlier (round-1) conclusion — superseded by the measurements above:** originally attributed the 3 s to ~15–20 small Spreadsheet RPCs. Partly true, but the dominant costs were the full-sheet read and the per-call customer-sheet open, not RPC count.

---

## Where the time actually goes

Every one of the calls below is a separate remote round-trip to the Sheets backend. Walking `reserveBookForCustomer` top to bottom:

| # | Line(s) | Operation | Cost driver |
|---|---------|-----------|-------------|
| 1 | 865 | `checkRateLimit_` → `CacheService` get + put | 2 cache calls (cheap) |
| 2 | 869 | `verifyCustomerSession_` → `CacheService` get + put | 2 cache calls (cheap) |
| 3 | 873 | `LockService.waitLock(5000)` | Acquires lock — **but note it is acquired AFTER rate-limit/session and can wait up to 5 s under contention** |
| 4 | 875 | `getCustomerRowContextById_` → `getCustomerDetailsSheetAndColumns_` → **`SpreadsheetApp.openById`** + `getSheetByName` + `getHeaderSearchValues_` (a `getRange().getValues()`) | **1 openById + 1 header read** |
| 5 | 875 | `getCustomerRowContextById_` → `findDataRowByExactValue_` → `createTextFinder().findNext()` | **1 TextFinder scan** of the customer sheet |
| 6 | 875 | `getCustomerRowContextById_` → `getSheetRowValues_` → `getLastColumn` + `getRange().getValues()` | **2 calls** |
| 7 | 888 | `getCustomerActiveReservationCount_` — usually reads the cached count column (cheap) **but if the count is blank/negative it calls `getActiveReservationsForCustomer_`** which does a **full `getSheetAndHeader_` + `getDataRange().getDisplayValues()` of the entire Books-DB** | **openById + full sheet scan** (conditional) |
| 8 | 907 | `getSheetAndHeader_` → **`SpreadsheetApp.openById` AGAIN** + `getSheetByName` + header read | **1 openById + 1 header read (redundant — Books-DB, but the spreadsheet was already opened in step 4)** |
| 9 | 908 | `getBookReservationLinkColumns_` → `getLastColumn` + `getRange().getValues()` header read (and possibly writes headers) | **2+ calls** |
| 10 | 909 | `findDataRowByExactValue_` → `getLastRow` + `createTextFinder().findNext()` on Books-DB | **2 calls (TextFinder scan)** |
| 11 | 912 | `getSheetRowValues_` → `getLastColumn` + `getRange().getValues()` | **2 calls** |
| 12 | 931 | `setSheetRowValues_` → `getLastColumn` + `getRange().setValues()` | **2 calls (the actual write)** |
| 13 | 932 | `adjustCustomerActiveReservationCount_` → `setCustomerActiveReservationCount_` → `getRange().setValue()` on customer sheet | **1 write** |
| 14 | 934 | `invalidatePublicBooksCache_` → `CacheService` removes | cache calls (cheap) |

**Round-trip count: ~15–20 Sheets RPCs per reservation**, and that is the *happy path*. If the cached reservation count is missing (step 7), you add a **full display-values read of the entire Books-DB sheet** on top.

### The two biggest offenders

1. **`SpreadsheetApp.openById()` is called at least twice** (step 4 for Customer Details, step 8 for Books-DB), and a **third time** inside `getActiveReservationsForCustomer_` whenever it runs. `openById` is one of the most expensive Apps Script calls. Every helper re-opens the spreadsheet from scratch instead of reusing a single handle.

2. **Full-sheet reads via `getDataRange().getDisplayValues()` / `.getValues()`.** `getActiveReservationsForCustomer_` (line 1828) and `getBooks`/`issueBook` read the *whole* Books-DB. On a library sheet with hundreds/thousands of rows this dominates. It runs opportunistically during reservation (step 7) and unconditionally in `getMyReservations`.

3. **Repeated `getLastColumn()` / `getLastRow()` / header re-reads.** `getSheetRowValues_`, `setSheetRowValues_`, `getBookReservationLinkColumns_`, and `getExistingBookReservationLinkColumns_` each independently re-fetch dimensions and headers instead of computing them once.

4. **`LockService.waitLock(5000)` acquired mid-function.** Under any concurrency, a second reservation blocks here. Combined with the slow critical section, contention makes the tail latency far worse than 3 s. The lock is held across ~10 RPCs — the wider the critical section, the more serialized every user becomes.

---

## Implementation status

| Fix | Status | Verified by user |
|-----|--------|------------------|
| Fix 1 — Open spreadsheet once (request-scoped cache) | ✅ **Implemented** | ⏳ pending |
| Fix 2 — Read the book row once, write once | ✅ **Implemented** | ⏳ pending |
| Fix 3 — Cache header/column layout per request | ✅ **Implemented** | ⏳ pending |
| Fix 4 — Trust the stored active-reservation count | ✅ **Implemented** | ⏳ pending |
| Fix 5 — Shrink & re-order the locked critical section | ✅ **Implemented** | ⏳ pending |
| Fix 6 — Use `getValues()` instead of `getDisplayValues()` on the hot path | ✅ **Implemented** | ⏳ pending |
| Client — Cache customer reservations, skip redundant `getMyReservations` | ✅ **Implemented** | ⏳ pending |
| Concurrency UX — Sync the UI when a reservation loses the race | ✅ **Implemented** | ⏳ pending |

> Statuses are **Implemented** (code changed, syntax-checked) but **not yet confirmed** against a real deployment. The user will test and then ask to mark each as **Confirmed / Optimised**.

### Concurrency correctness note

Two subscribers reserving the same book at the same time is handled correctly: all three write paths (`reserveBook`, `reserveBookForCustomer`, `unreserveMyBook`) acquire `LockService.getScriptLock()`, and inside the lock the code does `REQUEST_CACHE_.masterData = null` then re-reads Books-DB *fresh* before the availability check and single-row write. The loser reads the winner's committed `Reserved` status and is rejected. The request-scoped cache never shares state between the two separate executions.

**Loser UX:** the rejected subscriber sees a red toast — *"Sorry, this book is no longer available."* — and the client now also refreshes that book to its real status (the server returns `code: 'UNAVAILABLE'`, `bookNo`, and `status`), so the card/modal update immediately and the Reserve button disappears instead of letting them retry into the same error.

---

## Recommended fixes (in priority order)

### Fix 1 — Open the spreadsheet once and pass the handle around (biggest win) — ✅ Implemented
**What was done:** Added a request-scoped memo cache (`REQUEST_CACHE_`) plus `getSpreadsheet_()`, and made `getSheetAndHeader_()` and `getCustomerDetailsSheetAndColumns_()` memoize their `openById` + header work for the lifetime of one request. `reserveBook`, `reserveBookForCustomer`, `unreserveMyBook`, `getMyReservations`, and `getBooks` call `resetRequestCache_()` on entry so each web-app request starts clean. Net: **1 `openById` per spreadsheet per request** instead of 2–3.
**Code:** `Code.gs` — `REQUEST_CACHE_`, `resetRequestCache_`, `getSpreadsheet_`, `getSheetAndHeader_`, `getCustomerDetailsSheetAndColumns_`.

### Fix 2 — Read the target book row once, write once — ✅ Implemented
**What was done:** Added `getMasterData_()` (one `getDataRange().getValues()` per request, cached), `findRowIndexInValues_()` (in-memory row lookup, replaces the `getLastRow` + `TextFinder` scan), and `writeMasterRow_()` (single `setValues` for the one changed row). `reserveBook` / `reserveBookForCustomer` / `unreserveMyBook` now: read once → find index in memory → mutate the row array → write that one row. Removed the per-call `getSheetRowValues_`/`setSheetRowValues_`/`findDataRowByExactValue_` round-trips from these paths.
**Code:** `Code.gs` — `getMasterData_`, `findRowIndexInValues_`, `writeMasterRow_`, `findReservedRowIndexByReservationId_`, and the three reservation functions.

### Fix 3 — Cache the header/column layout — ✅ Implemented
**What was done:** Header row + column-index maps for Books-DB and Customer-Details are now resolved once and stored in `REQUEST_CACHE_` (`masterSheet`, `customerDetails`), so `getBookReservationLinkColumns_` / `getExistingBookReservationLinkColumns_` / `getMasterColumnMap_` are not re-run on every helper call within a request.
**Code:** `Code.gs` — memoization inside `getSheetAndHeader_` / `getCustomerDetailsSheetAndColumns_`; `getMasterData_` resolves `linkColumns` once.

### Fix 4 — Trust the cached active-reservation count; avoid the full-sheet fallback on the hot path — ✅ Implemented
**What was done:** The limit check still trusts the stored `Active Reservation Count`. When it *does* need to reconcile (count ≥ limit), `getActiveReservationsForCustomer_()` now reads from the **already-loaded** request-scoped `getMasterData_()` values rather than re-opening the spreadsheet and doing a second full `getDisplayValues()` scan.
**Code:** `Code.gs` — `getActiveReservationsForCustomer_` rewritten to use `getMasterData_()`.

### Fix 5 — Shrink and re-order the locked critical section — ✅ Implemented
**What was done:** In `reserveBookForCustomer`, session verify / rate limit / customer lookup / limit check now run **before** `lock.waitLock(5000)`. The lock now wraps only: force-fresh read (`REQUEST_CACHE_.masterData = null` → `getMasterData_()`) → availability check → single row write. The availability check stays **inside** the lock (reads current status from the fresh read), so it remains race-free.
**Code:** `Code.gs` — `reserveBookForCustomer`.

### Fix 6 — Avoid `getDisplayValues()` where `getValues()` suffices — ✅ Implemented
**What was done:** The reservation hot path (`getMasterData_`, `getActiveReservationsForCustomer_`) now uses raw `getValues()` and formats the `reservedAt` date via the existing `formatDate_()` helper only where a display string is needed. `getBooks`/`getImageMap_` still use `getDisplayValues()` (they legitimately need formatted display strings and are outside the reservation write path).
**Code:** `Code.gs` — `getMasterData_`, `getActiveReservationsForCustomer_`.

### Client fix — Cache customer reservations; skip redundant `getMyReservations` — ✅ Implemented
**What was done:** Added `myReservationsCache` in `Index.html`. `hydrateMyReservationAction()` now reuses the cached list instead of calling `getMyReservations` (a full Books-DB scan) on every reserved-book modal open. The cache is invalidated on reserve, unreserve, and logout so it never goes stale or leaks across customers. The just-reserved book was already handled locally via `refreshBook(..., isMyReservation:true)`.
**Code:** `Index.html` — `myReservationsCache`, `hydrateMyReservationAction`, `applyMyReservationToModal_`, and invalidation in `reserveLoggedInCustomer` / `unreserveThenRetry` / `unreserveMyActiveBook` / `clearCustomerSession`.

---

## Expected impact

- **Fix 1 + Fix 2 alone** typically cut the reservation from ~15–20 RPCs to ~5–7 — realistically **3+ s → well under 1 s**.
- **Fix 3 + Fix 4** remove the remaining full-sheet reads and header churn.
- **Fix 5** improves the *concurrent* case (multiple kids/parents reserving at once), which is where the current design degrades worst.
- **Client fix** removes a full-sheet server round-trip from the reserved-book modal interaction.

## What is NOT the problem

- The frontend does **not** do a full `loadBooks()` after a successful reserve — `reserveLoggedInCustomer` updates the one card locally via `refreshBook`. So the 3 s was entirely server-side, inside `reserveBookForCustomer` (plus the modal's `hydrateMyReservationAction` call, now cached).
- `CacheService`/`LockService` calls themselves are cheap; the cost is the Sheets RPCs and `openById`.

---

## Verification checklist (for the user to run after deploy)

1. Reserve a book as a logged-in customer → should complete noticeably faster (< 1 s).
2. Reserve a second book → confirm the count/limit logic still works.
3. Hit the monthly limit → the LIMIT_REACHED modal still lists your active reservations.
4. Unreserve a book (from the modal and from the limit modal) → status returns to Available, count decrements.
5. Open a reserved book's detail modal a second time → no visible delay (served from `myReservationsCache`).
6. Anonymous reserve (logged-out) → still works.
7. Concurrent reserve by two users → no double-booking (lock still guards the write); the loser sees "no longer available" **and** the book's card/modal flip to Reserved with the Reserve button gone.

Once verified, ask to update the **Implementation status** table from ⏳ pending → ✅ **Confirmed / Optimised**.

---

*Code changes have been applied (Code.gs, Index.html) and syntax-checked. Runtime performance is pending the user's test.*

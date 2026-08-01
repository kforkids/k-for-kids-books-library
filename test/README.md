# Automated tests

Runs entirely locally with Node + Vitest — no Google account, no live
spreadsheet, no deployment needed.

```bash
npm install
npm test          # run once
npm run test:watch   # re-run on file changes
```

## What's covered, and why not everything is

`Code.gs` and `Index.html` are Google Apps Script files: their runtime
(`SpreadsheetApp`, `DriveApp`, `CacheService`, `PropertiesService`, `Session`,
`Utilities`, `google.script.run`) only exists on Google's servers / inside a
real browser talking to a deployed Apps Script web app. Most of the app's
biggest functions (`getBooks`, `reserveBookForCustomer`, `issueBook`, ...)
weave business logic together with several of those calls at once, so they
aren't included here — testing them meaningfully would mean either a full
fake spreadsheet/Drive layer (large effort, easy to get subtly wrong) or a
live `clasp`-deployed test environment (slow, flaky, needs real Google
credentials).

Instead this suite targets the pieces that already carry real, valuable
logic and can be tested honestly:

- **Pure functions** — validators, formatters, normalizers, parsers — with
  zero Apps Script calls at all.
- **Semi-pure functions** — touch 1-2 Apps Script globals (`CacheService`,
  `PropertiesService`) — tested against small hand-rolled fakes
  (`test/support/loadGasSource.js`) that behave like the real thing for
  exactly the calls these functions make (get/put/remove with TTL).
- **Frontend rendering logic** (`bookCardHtml` and friends) — run against
  fixture book data covering the real scenarios that have actually broken in
  this app before (missing cover image, many hover-detail rows, admin vs.
  customer vs. anonymous viewers).

## How the loader works

`test/support/loadGasSource.js` reads the REAL, unmodified bytes of
`Code.gs` / `Index.html`'s inline `<script>` block and executes them in a
Node `vm` sandbox with fake Apps Script globals injected — this is not a
reimplementation of the app's logic, it's the actual shipped source running
with its runtime dependencies swapped out.

Two important gotchas this file documents and works around (see comments in
the file itself and `test/unit/loader.smoke.test.js` for standalone proof):

1. **npm's rollup optional-dependency bug**: if `npx vitest` fails with
   `Cannot find module @rollup/rollup-darwin-arm64` (or another platform's
   equivalent), run `npm install <package-name> --save-optional` for the
   package named in the error, or delete `node_modules`/`package-lock.json`
   and reinstall.
2. **Node vm's `let`/`const` scoping**: `Index.html` keeps session state
   (`adminMode`, `currentCustomer`, `myReadBooks`, ...) in top-level `let`
   bindings. Node's `vm` module gives those their own lexical environment,
   separate from the sandbox object — so `sandbox.adminMode = true` from
   *outside* the vm silently does nothing to what code *inside* the vm
   reads. Function declarations don't have this problem (they do become real
   sandbox properties). Tests that need to flip session state use
   `app.run('adminMode = true')`, which executes inside the same vm context
   and mutates the real binding.

## Fixtures

- `test/fixtures/books.js` — a small synthetic book/customer catalog with
  the scenarios the app needs to render correctly: available / reserved /
  issued, with and without a cover image, admin-hidden, long author names
  that produce many hover-detail rows, and customers with an explicit
  reservation limit vs. one parsed from plan text vs. no limit at all.
- `test/fixtures/images/` — `cover-normal.jpg` / `cover-alt.jpg` are copies of
  two real covers from `book-images/`; `cover-busy-light.svg` reproduces the
  color layout of the book cover that caused the hover-overlay legibility bug
  fixed earlier (dark green background, light cream title box, colorful
  illustration) as a deterministic regression fixture.

## A bug this suite found

While writing the rate-limit tests, `checkRateLimit_` (Code.gs) turned out to
have a latent bug: it reads back a stored window-start timestamp with
`parseInt(parts[1], 10) || now`, so a window that started at exactly
timestamp `0` gets silently treated as brand new on every call instead of
expiring correctly. This never fires in production (`Date.now()` is always a
huge epoch value, never literally `0`), so it's documented as a "KNOWN BUG"
test in `test/unit/rate-limit.test.js` rather than silently worked around.

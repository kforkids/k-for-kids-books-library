// Loads REAL source from Code.gs / Index.html into a vm sandbox and exposes
// the top-level functions on it. This is not a reimplementation: the exact
// bytes shipped to Apps Script / the browser are executed here, with fake
// Apps Script globals (CacheService, PropertiesService, Session, Utilities,
// LockService, Logger, MailApp) injected in place of the real ones, which
// only exist on Google's servers.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function loadCodeGs(overrides = {}) {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'app-script', 'Code.gs'), 'utf8');
  const sandbox = buildSandbox(overrides);
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: 'Code.gs' });
  return attachRunHandle(sandbox, context);
}

// Node's vm module gives top-level `let`/`const` bindings their own lexical
// environment, separate from the sandbox/global object — so `sandbox.foo = x`
// from OUTSIDE the vm does NOT change what code running INSIDE the vm sees for
// a `let foo` declared at top level (only `var`/function declarations become
// real properties of the sandbox object; see loadGasSource.test.js for a
// standalone proof). Code.gs's own state is all consts assigned once at load
// and never reassigned, so this doesn't bite it — but Index.html declares
// mutable session state with `let` (adminMode, currentCustomer, myReadBooks,
// ...), which tests DO need to flip between scenarios. `run(code)` executes a
// snippet inside the SAME context, so `app.run('adminMode = true')` mutates
// the real binding, and `app.run('adminMode')` reads it back reliably.
function attachRunHandle(sandbox, context) {
  sandbox.run = code => vm.runInContext(code, context);
  return sandbox;
}

// A controllable clock for time-dependent logic (rate limiting, session TTLs).
// vi.useFakeTimers() from the test runner cannot reach into a separate vm
// context's global Date, so time control has to be plumbed through explicitly:
// pass the same clock to loadCodeGs({ clock }) and to fakeCacheService(clock),
// then call clock.advance(ms) / clock.set(ms) from the test.
export function fakeClock(startMs = 0) {
  let current = startMs;
  return {
    now: () => current,
    advance(ms) { current += ms; },
    set(ms) { current = ms; }
  };
}

// Extracts the inline <script>...</script> body from Index.html and executes
// it in a sandbox with minimal DOM/global stubs. Only pure/near-pure helper
// functions are expected to be exercised from tests — anything that touches
// document.* will throw unless the caller supplies a fuller `document` stub
// via overrides.
export function loadIndexHtmlScript(overrides = {}) {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'app-script', 'Index.html'), 'utf8');
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error('Could not find inline <script> block in Index.html');
  const source = match[1];

  const sandbox = buildSandbox({
    document: {
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      ...(overrides.document || {})
    },
    window: {},
    localStorage: fakeLocalStorage(),
    google: undefined,
    // Real script does `new bootstrap.Modal('#someId')` at top-level scope for
    // several modals — must be a working fake constructor, not undefined, or
    // the whole script aborts before reaching any function declaration below it.
    bootstrap: { Modal: class { hide() {} show() {} } },
    IntersectionObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    ...overrides
  });
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: 'Index.html#inline-script' });
  return attachRunHandle(sandbox, context);
}

function buildSandbox(overrides) {
  const clock = overrides.clock || fakeClock(Date.now());
  const sandbox = {
    console,
    CacheService: overrides.CacheService || fakeCacheService(clock),
    PropertiesService: overrides.PropertiesService || fakePropertiesService(),
    Session: overrides.Session || fakeSession(),
    Utilities: overrides.Utilities || fakeUtilities(),
    LockService: overrides.LockService || fakeLockService(),
    Logger: overrides.Logger || { log() {} },
    MailApp: overrides.MailApp || { sendEmail() {} },
    SpreadsheetApp: overrides.SpreadsheetApp,
    DriveApp: overrides.DriveApp,
    ...overrides
  };
  // Route the sandbox's own Date.now() through the same clock so code inside
  // the vm (e.g. checkRateLimit_'s `Date.now()` calls) advances in lockstep
  // with whatever the fake CacheService sees — the real Date object cannot be
  // mocked across a vm context boundary via vi.useFakeTimers().
  if (!overrides.Date) {
    class SandboxDate extends Date {
      static now() { return clock.now(); }
    }
    sandbox.Date = SandboxDate;
  }
  sandbox.__clock = clock;
  return sandbox;
}

export function fakeCacheService(clock) {
  const store = new Map(); // key -> { value, expiresAtMs }
  const now = clock ? clock.now : () => Date.now();
  return {
    getScriptCache() {
      return {
        get(key) {
          const entry = store.get(key);
          if (!entry) return null;
          if (entry.expiresAtMs !== null && now() > entry.expiresAtMs) {
            store.delete(key);
            return null;
          }
          return entry.value;
        },
        put(key, value, ttlSeconds) {
          const expiresAtMs = ttlSeconds ? now() + ttlSeconds * 1000 : null;
          store.set(key, { value: String(value), expiresAtMs });
        },
        remove(key) {
          store.delete(key);
        },
        removeAll(keys) {
          keys.forEach(k => store.delete(k));
        }
      };
    },
    // Test-only escape hatch to inspect/mutate the underlying store directly.
    __store: store
  };
}

export function fakePropertiesService(initialProps = {}) {
  const props = new Map(Object.entries(initialProps));
  return {
    getScriptProperties() {
      return {
        getProperty(key) {
          return props.has(key) ? props.get(key) : null;
        },
        setProperty(key, value) {
          props.set(key, String(value));
        }
      };
    },
    __props: props
  };
}

export function fakeSession(overrides = {}) {
  return {
    getScriptTimeZone: () => overrides.timeZone || 'Asia/Kolkata',
    getTemporaryActiveUserKey: () => overrides.tempUserKey || 'fake-temp-user-key',
    getActiveUser: () => ({ getEmail: () => overrides.activeUserEmail || '' }),
    getEffectiveUser: () => ({ getEmail: () => overrides.effectiveUserEmail || '' })
  };
}

export function fakeUtilities() {
  let counter = 0;
  return {
    getUuid: () => `fake-uuid-${++counter}`,
    formatDate: (date, tz, format) => date.toISOString()
  };
}

export function fakeLockService() {
  return {
    getScriptLock() {
      return {
        tryLock() { return true; },
        waitLock() {},
        releaseLock() {}
      };
    }
  };
}

function fakeLocalStorage() {
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };
}

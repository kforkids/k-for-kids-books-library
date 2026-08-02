import { describe, it, expect, beforeEach } from 'vitest';
import { loadIndexHtmlScript, fakeDocument } from '../support/loadGasSource.js';

// Regression (mirror of logout.test.js, opposite direction): logging in as a
// NEW customer while a PREVIOUS customer's stats data was still on screen
// used to leave that stale data visible — attributed to the wrong person —
// until loadMyReadBooks()'s server round-trip resolved. Now
// handleCustomerAuthResponse (and the admin-login branch of doLogin) reset
// myReadBooks/myReadHistory and re-render the stats strip immediately on a
// successful login response.
function buildDocument() {
  const doc = fakeDocument();
  doc.__withClasses('statTotalLink', 'stat-admin', 'stat-link');
  doc.__withClasses('statAvailableLink', 'stat-admin', 'stat-link');
  doc.__withClasses('statReservedLink', 'stat-admin', 'stat-link');
  doc.__withClasses('statIssuedLink', 'stat-admin', 'stat-link');
  doc.__withClasses('statMyReservedLink', 'stat-customer', 'stat-link');
  doc.__withClasses('statMyIssuedLink', 'stat-customer', 'stat-link');
  doc.__withClasses('statMyReadLink', 'stat-customer', 'stat-link');
  doc.__withClasses('noImageBtn', 'admin-only-filter');
  return doc;
}

// google.script.run's chained .withSuccessHandler().withFailureHandler().foo()
// must never actually resolve here — these tests are specifically about the
// gap BEFORE any server round-trip completes.
function neverResolvingGoogleScriptRun() {
  const handler = { get: () => () => proxy };
  const proxy = new Proxy({}, handler);
  return { script: { run: proxy } };
}

describe('handleCustomerAuthResponse — fresh login clears the PREVIOUS session\'s stats immediately', () => {
  let app;
  let document_;

  beforeEach(() => {
    document_ = buildDocument();
    app = loadIndexHtmlScript({ document: document_, google: neverResolvingGoogleScriptRun() });

    // Old customer was logged in with read history — the stale state that
    // must not survive a fresh login.
    app.run(`
      customerToken = 'old-token';
      currentCustomer = { customerId: 'C_OLD', name: 'Old Customer', accountStatus: 'Active' };
      myReadBooks = new Set(['M0001']);
      myReadHistory = [{ bookNo: 'M0001', bookName: 'Franklin chi christmas bhet' }];
      allBooks = [{ bookNo: 'M0001', bookName: 'Franklin chi christmas bhet', status: 'Available', language: 'marathi', ageGroup: '3-7', author: '', category: '' }];
    `);
    app.updateStats();
  });

  it('sanity check: the old customer\'s data is visible before the new login', () => {
    expect(app.run('myReadBooks.size')).toBe(1);
  });

  it('clears the previous read-history data immediately on a successful login response', () => {
    app.handleCustomerAuthResponse({
      success: true,
      token: 'new-token',
      customer: { customerId: 'C_NEW', name: 'Test One', accountStatus: 'Active' },
      message: 'Logged in successfully.'
    });
    expect(app.run('myReadBooks.size')).toBe(0);
    expect(app.run('myReadHistory.length')).toBe(0);
  });

  it('does not touch session state on a failed login response', () => {
    app.handleCustomerAuthResponse({ success: false, error: 'Invalid password.' });
    // Old session must remain untouched on failure.
    expect(app.run('myReadBooks.size')).toBe(1);
    expect(app.run('currentCustomer.customerId')).toBe('C_OLD');
  });
});

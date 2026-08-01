import { describe, it, expect, beforeEach } from 'vitest';
import { loadIndexHtmlScript, fakeDocument } from '../support/loadGasSource.js';

// Regression: logging out used to leave the stats strip ("N read before") and
// the "Recently read by you" section showing the PREVIOUS customer's data
// until the next loadBooks() server round-trip completed — a real, visible
// gap whenever that reload was slow. clearCustomerSession() now calls
// updateStats()/renderRecentlyRead() itself so both hide immediately,
// without waiting on any network call.
function buildDocument() {
  const doc = fakeDocument();
  // Elements read by updateStats()/renderCustomerState()/renderRecentlyRead()
  // that the real Index.html markup carries specific classes on.
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

describe('clearCustomerSession — logout hides customer-only UI synchronously', () => {
  let app;
  let document_;

  beforeEach(() => {
    document_ = buildDocument();
    app = loadIndexHtmlScript({ document: document_ });

    // Simulate an active, logged-in customer who has read one book — the
    // exact state that produces "1 read before" + a populated recently-read
    // section, matching the reported scenario.
    app.run(`
      customerToken = 'fake-token';
      currentCustomer = { customerId: 'C001', name: 'Test Parent', accountStatus: 'Active' };
      myReadBooks = new Set(['M0001']);
      myReadHistory = [{ bookNo: 'M0001', bookName: 'Franklin chi christmas bhet' }];
      allBooks = [{ bookNo: 'M0001', bookName: 'Franklin chi christmas bhet', status: 'Available', language: 'marathi', ageGroup: '3-7', author: '', category: '' }];
    `);
    app.updateStats();
    app.renderRecentlyRead();
  });

  it('sanity check: the logged-in state shows the stats strip and recently-read section', () => {
    expect(document_.getElementById('statsBar').style.display).toBe('');
    expect(document_.getElementById('recentlyReadSection').style.display).toBe('');
  });

  it('hides the stats strip immediately when clearCustomerSession runs, before any reload', () => {
    app.clearCustomerSession();
    expect(document_.getElementById('statsBar').style.display).toBe('none');
  });

  it('hides the "Recently read by you" section immediately when clearCustomerSession runs', () => {
    app.clearCustomerSession();
    expect(document_.getElementById('recentlyReadSection').style.display).toBe('none');
    expect(document_.getElementById('recentlyReadGrid').innerHTML).toBe('');
  });

  it('clears the underlying read-history data too, not just the DOM', () => {
    app.clearCustomerSession();
    expect(app.run('myReadBooks.size')).toBe(0);
    expect(app.run('myReadHistory.length')).toBe(0);
  });
});

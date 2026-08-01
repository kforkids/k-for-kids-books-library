import { describe, it, expect, beforeEach } from 'vitest';
import { loadIndexHtmlScript } from '../support/loadGasSource.js';
import { findTestBook } from '../fixtures/books.js';

// bookCardHtml() reads several module-level globals directly (adminMode,
// currentCustomer, myReadBooks) — those are `let` bindings inside the vm
// context, which do NOT sync with plain property assignment on the returned
// object (see loader.smoke.test.js). app.run(...) executes inside the same
// context, so it mutates the real bindings the way the live app does when a
// session starts/ends.
function setViewerState(app, { admin = false, customer = null, readBooks = [] } = {}) {
  app.run(`adminMode = ${JSON.stringify(admin)}`);
  app.run(`currentCustomer = ${JSON.stringify(customer)}`);
  app.run(`myReadBooks = new Set(${JSON.stringify(readBooks.map(String))})`);
}

describe('bookCardHtml — cover rendering (shimmer / no-cover / real image)', () => {
  let app;
  beforeEach(() => {
    app = loadIndexHtmlScript();
    setViewerState(app, { admin: true });
  });

  it('renders an <img> plus a shimmer-eligible placeholder when the book has an imageUrl', () => {
    const html = app.bookCardHtml(findTestBook('E0001'));
    expect(html).toContain('<img src=');
    // Placeholder must NOT carry no-shimmer when an image is expected to load.
    expect(html).toMatch(/class="book-img-placeholder\s*">/);
    expect(html).not.toMatch(/book-img-placeholder no-shimmer/);
  });

  it('wires onload to hide the placeholder and onerror to freeze the shimmer', () => {
    const html = app.bookCardHtml(findTestBook('E0001'));
    expect(html).toContain(`onload="this.nextElementSibling.style.display='none'"`);
    expect(html).toContain(`onerror="this.style.display='none';this.nextElementSibling.classList.add('no-shimmer')"`);
  });

  it('renders no <img> tag and a permanently non-shimmering placeholder when there is no cover at all', () => {
    const html = app.bookCardHtml(findTestBook('E0004')); // "A Book With No Cover At All"
    expect(html).not.toContain('<img src=');
    expect(html).toContain('book-img-placeholder no-shimmer');
  });

  it('still shows the book icon and book number inside the placeholder', () => {
    const html = app.bookCardHtml(findTestBook('E0004'));
    expect(html).toContain('bi bi-book');
    expect(html).toContain('<small>E0004</small>');
  });
});

describe('bookCardHtml — title-on-cover regression (must always render, never rely on hover)', () => {
  it('renders the title inside book-title, visible without hovering', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: false, customer: { customerId: 'C001' } });
    const html = app.bookCardHtml(findTestBook('E0001'));
    expect(html).toMatch(/<div class="book-title">The Gruffalo<\/div>/);
  });

  it('HTML-escapes the title to prevent injection via a crafted book name', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: true });
    const book = findTestBook('E0001');
    book.bookName = `<img src=x onerror=alert(1)>`;
    const html = app.bookCardHtml(book);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('bookCardHtml — badge placement (regression: read-badge vs status-badge vs hidden-badge must not collide)', () => {
  it('shows the status badge for an admin viewer', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: true });
    const html = app.bookCardHtml(findTestBook('E0002')); // Reserved
    expect(html).toContain('badge-reserved');
    expect(html).toContain('>Reserved<');
  });

  it('shows the hidden-badge only for admins viewing a hidden book', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: true });
    const html = app.bookCardHtml(findTestBook('E0005')); // Hidden
    expect(html).toContain('hidden-badge');
    expect(html).toContain('is-hidden-admin');
  });

  it('never shows the hidden-badge to a non-admin viewer', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: false, customer: { customerId: 'C001' } });
    const html = app.bookCardHtml(findTestBook('E0005'));
    expect(html).not.toContain('hidden-badge');
  });

  it('shows the read-badge only for a logged-in (non-admin) customer who has read the book before', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: false, customer: { customerId: 'C001' }, readBooks: ['E0003'] });
    const html = app.bookCardHtml(findTestBook('E0003'));
    expect(html).toContain('read-badge');
    expect(html).toContain('Read before');
  });

  it('read-badge and hidden-badge are mutually exclusive by construction (admin never sees read-badge)', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: true, readBooks: ['E0003'] });
    const html = app.bookCardHtml(findTestBook('E0003'));
    expect(html).not.toContain('read-badge');
  });
});

describe('bookCardHtml — hover-detail overlay content (regression: overlay must show every applicable row)', () => {
  it('includes author, category, language, and formatted age group for an admin viewer', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: true });
    const html = app.bookCardHtml(findTestBook('E0001'));
    expect(html).toContain('Julia Donaldson');
    expect(html).toContain('Picture Book');
    expect(html).toContain('english');
    expect(html).toContain('Ages 3-5');
  });

  it('includes the admin-only book code and issuedTo line when applicable', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: true });
    const html = app.bookCardHtml(findTestBook('E0003')); // Issued to Test Parent
    expect(html).toContain('hover-code');
    expect(html).toContain('E0003');
    expect(html).toContain('Test Parent');
  });

  it('never leaks the admin-only book code or issuedTo to a non-admin viewer', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: false, customer: { customerId: 'C001' } });
    const html = app.bookCardHtml(findTestBook('E0003'));
    expect(html).not.toContain('hover-code');
    expect(html).not.toContain('Test Parent');
  });

  it('always renders the "Tap for details" hint regardless of how many detail rows precede it', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: true });
    const html = app.bookCardHtml(findTestBook('M0001')); // long author, many detail rows
    expect(html).toContain('Tap for details');
    expect(html).toContain('bi-arrows-fullscreen');
  });
});

describe('bookCardHtml — status visibility (canSeeBookStatus gate)', () => {
  it('hides the status badge from an anonymous/pending viewer', () => {
    const app = loadIndexHtmlScript();
    setViewerState(app, { admin: false, customer: null });
    const html = app.bookCardHtml(findTestBook('E0002'));
    expect(html).not.toContain('status-badge');
  });

  it('shows the status badge to an active logged-in customer', () => {
    const app = loadIndexHtmlScript();
    app.isCustomerActive = () => true; // isolate from accountStatus wiring, which is covered elsewhere
    setViewerState(app, { admin: false, customer: { customerId: 'C001' } });
    const html = app.bookCardHtml(findTestBook('E0002'));
    expect(html).toContain('status-badge');
  });
});

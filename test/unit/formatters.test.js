import { describe, it, expect } from 'vitest';
import { loadIndexHtmlScript } from '../support/loadGasSource.js';
import { TEST_CUSTOMERS } from '../fixtures/books.js';

const app = loadIndexHtmlScript();

describe('statusClass', () => {
  it.each([
    ['Available', 'available'],
    ['Reserved', 'reserved'],
    ['Issued', 'issued']
  ])('maps %s to %s', (status, expected) => {
    expect(app.statusClass(status)).toBe(expected);
  });

  it('falls back to available for an unrecognized status', () => {
    expect(app.statusClass('SomeUnknownStatus')).toBe('available');
  });
});

describe('formatAgeGroup', () => {
  it('returns empty string for blank input', () => {
    expect(app.formatAgeGroup('')).toBe('');
    expect(app.formatAgeGroup(null)).toBe('');
  });

  it('normalizes "all age groups" phrasing to "All ages"', () => {
    expect(app.formatAgeGroup('All Age Groups')).toBe('All ages');
    expect(app.formatAgeGroup('all ages')).toBe('All ages');
  });

  it('passes through a value already starting with "Ages"', () => {
    expect(app.formatAgeGroup('Ages 3-5')).toBe('Ages 3-5');
  });

  it('prefixes a bare numeric range with "Ages "', () => {
    expect(app.formatAgeGroup('3-5')).toBe('Ages 3-5');
  });

  it('returns non-numeric, non-"all ages" text unchanged', () => {
    expect(app.formatAgeGroup('Young Adult')).toBe('Young Adult');
  });
});

describe('ageGroupFilterValue', () => {
  it('lowercases and trims', () => {
    expect(app.ageGroupFilterValue('  Ages 3-5  ')).toBe('ages 3-5');
  });

  it('returns empty string for blank input', () => {
    expect(app.ageGroupFilterValue('')).toBe('');
  });
});

describe('escHtml / escAttr', () => {
  it('escapes &, <, >, and " (but not single quotes)', () => {
    expect(app.escHtml(`<script>&"'</script>`)).toBe('&lt;script&gt;&amp;&quot;\'&lt;/script&gt;');
  });

  it('escAttr additionally escapes single quotes for attribute contexts', () => {
    expect(app.escAttr(`It's a "test" <tag>`)).toBe('It&#39;s a &quot;test&quot; &lt;tag&gt;');
  });

  it('treats null/undefined as empty string rather than throwing', () => {
    expect(app.escHtml(null)).toBe('');
    expect(app.escHtml(undefined)).toBe('');
  });
});

describe('customerLimitFor_ (mirrors server parseMonthlyReservationLimit_)', () => {
  it('uses the explicit monthlyReservationLimit when set and positive', () => {
    const [active] = TEST_CUSTOMERS;
    expect(app.customerLimitFor_(active)).toBe(5);
  });

  it('falls back to parsing the first number out of the plan name', () => {
    const planTextOnly = TEST_CUSTOMERS.find(c => c.customerId === 'C003');
    expect(app.customerLimitFor_(planTextOnly)).toBe(12);
  });

  it('returns 0 when neither an explicit limit nor a plan number is present', () => {
    const pending = TEST_CUSTOMERS.find(c => c.customerId === 'C002');
    expect(app.customerLimitFor_(pending)).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { loadIndexHtmlScript } from '../support/loadGasSource.js';

const app = loadIndexHtmlScript();

describe('normalizePhoneDigits_', () => {
  it('strips spaces and dashes', () => {
    expect(app.normalizePhoneDigits_('98765 43210')).toBe('9876543210');
    expect(app.normalizePhoneDigits_('98765-43210')).toBe('9876543210');
  });

  it('strips a +91 country code prefix', () => {
    expect(app.normalizePhoneDigits_('+919876543210')).toBe('9876543210');
  });

  it('strips a leading 0 (STD-style prefix)', () => {
    expect(app.normalizePhoneDigits_('09876543210')).toBe('9876543210');
  });

  it('leaves an already-clean 10-digit number untouched', () => {
    expect(app.normalizePhoneDigits_('9876543210')).toBe('9876543210');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(app.normalizePhoneDigits_(null)).toBe('');
    expect(app.normalizePhoneDigits_(undefined)).toBe('');
    expect(app.normalizePhoneDigits_('')).toBe('');
  });
});

describe('isValidEmail_', () => {
  it('accepts a normal email', () => {
    expect(app.isValidEmail_('parent@example.com')).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(app.isValidEmail_('  parent@example.com  ')).toBe(true);
  });

  it.each([
    ['missing @', 'parentexample.com'],
    ['missing domain', 'parent@'],
    ['missing tld', 'parent@example'],
    ['contains a space', 'par ent@example.com'],
    ['empty string', ''],
    ['null', null]
  ])('rejects %s', (_label, value) => {
    expect(app.isValidEmail_(value)).toBe(false);
  });
});

describe('isValidPhone_', () => {
  it.each(['6000000000', '7123456789', '8123456789', '9123456789'])(
    'accepts a valid 10-digit Indian mobile number starting %s',
    number => {
      expect(app.isValidPhone_(number)).toBe(true);
    }
  );

  it('accepts a number with a +91 prefix after normalization', () => {
    expect(app.isValidPhone_('+91 9876543210')).toBe(true);
  });

  it.each([
    ['starts with 5 (landline-range digit)', '5876543210'],
    ['too short', '987654321'],
    ['too long', '98765432100'],
    ['empty', '']
  ])('rejects %s', (_label, value) => {
    expect(app.isValidPhone_(value)).toBe(false);
  });
});

describe('firstError_', () => {
  it('returns the first failing message in order', () => {
    const msg = app.firstError_([
      { ok: true, msg: 'first is fine' },
      { ok: false, msg: 'second fails' },
      { ok: false, msg: 'third also fails but should not be reported' }
    ]);
    expect(msg).toBe('second fails');
  });

  it('returns empty string when every check passes', () => {
    expect(app.firstError_([{ ok: true, msg: 'x' }, { ok: true, msg: 'y' }])).toBe('');
  });

  it('returns empty string for an empty checks array', () => {
    expect(app.firstError_([])).toBe('');
  });
});

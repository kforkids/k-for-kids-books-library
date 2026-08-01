import { describe, it, expect, beforeEach } from 'vitest';
import { loadCodeGs, fakeCacheService, fakePropertiesService } from '../support/loadGasSource.js';

describe('verifyAdmin_ (password check)', () => {
  it('accepts the password stored in script properties', () => {
    const app = loadCodeGs({ PropertiesService: fakePropertiesService({ ADMIN_PASSWORD: 'correct-horse' }) });
    expect(app.verifyAdmin_('correct-horse')).toBe(true);
  });

  it('rejects a wrong password', () => {
    const app = loadCodeGs({ PropertiesService: fakePropertiesService({ ADMIN_PASSWORD: 'correct-horse' }) });
    expect(app.verifyAdmin_('wrong-password')).toBe(false);
  });

  it('rejects when no admin password is configured at all', () => {
    const app = loadCodeGs({ PropertiesService: fakePropertiesService({}) });
    expect(app.verifyAdmin_('anything')).toBe(false);
  });
});

describe('verifyAdminCredentials_ (username + password)', () => {
  const props = { ADMIN_USERNAME: 'Admin', ADMIN_PASSWORD: 'secret123' };

  it('matches case-insensitively on the username', () => {
    const app = loadCodeGs({ PropertiesService: fakePropertiesService(props) });
    expect(app.verifyAdminCredentials_('admin', 'secret123')).toBe(true);
    expect(app.verifyAdminCredentials_('ADMIN', 'secret123')).toBe(true);
  });

  it('is case-SENSITIVE on the password', () => {
    const app = loadCodeGs({ PropertiesService: fakePropertiesService(props) });
    expect(app.verifyAdminCredentials_('admin', 'SECRET123')).toBe(false);
  });

  it('rejects when admin credentials are not configured', () => {
    const app = loadCodeGs({ PropertiesService: fakePropertiesService({}) });
    expect(app.verifyAdminCredentials_('admin', 'secret123')).toBe(false);
  });
});

describe('verifyAdminCredential_ (session token validity + sliding expiry)', () => {
  let app;
  let cache;

  beforeEach(() => {
    app = loadCodeGs();
    cache = app.CacheService.getScriptCache();
  });

  it('rejects a falsy/empty token without touching the cache', () => {
    expect(app.verifyAdminCredential_('')).toBe(false);
    expect(app.verifyAdminCredential_(null)).toBe(false);
  });

  it('rejects a token that was never issued', () => {
    expect(app.verifyAdminCredential_('never-issued-token')).toBe(false);
  });

  it('accepts a token that is present in the session cache', () => {
    const token = 'valid-session-token';
    cache.put(app.adminSessionKey_(token), '1', app.ADMIN_SESSION_SECS);
    expect(app.verifyAdminCredential_(token)).toBe(true);
  });

  it('slides the expiry forward on every successful check (refreshes TTL)', () => {
    const token = 'sliding-token';
    const key = app.adminSessionKey_(token);
    cache.put(key, '1', 10); // 10s TTL, about to expire
    expect(app.verifyAdminCredential_(token)).toBe(true);
    const entry = app.CacheService.__store.get(key);
    // Sliding expiry means the TTL was rewritten to the full 2-hour window,
    // not left at the original ~10s.
    expect(entry.expiresAtMs - Date.now()).toBeGreaterThan(7000 * 1000);
  });

  it('a logged-out (removed) token is rejected', () => {
    const token = 'about-to-logout';
    cache.put(app.adminSessionKey_(token), '1', app.ADMIN_SESSION_SECS);
    app.logoutAdminSession(token);
    expect(app.verifyAdminCredential_(token)).toBe(false);
  });
});

describe('validateAdminToken (thin wrapper used by restoreAdminSession on reload)', () => {
  it('returns { success: true } for a live session', () => {
    const app = loadCodeGs();
    const cache = app.CacheService.getScriptCache();
    const token = 'reload-token';
    cache.put(app.adminSessionKey_(token), '1', app.ADMIN_SESSION_SECS);
    expect(app.validateAdminToken(token)).toEqual({ success: true });
  });

  it('returns { success: false } for an expired/unknown token', () => {
    const app = loadCodeGs();
    expect(app.validateAdminToken('unknown-token')).toEqual({ success: false });
  });
});

describe('adminSessionKey_ (cache key sanitization)', () => {
  it('strips characters outside [a-zA-Z0-9-] so a malicious token cannot inject cache keys', () => {
    const app = loadCodeGs();
    expect(app.adminSessionKey_('abc123-XYZ')).toBe('ADMIN_SESSION_abc123-XYZ');
    expect(app.adminSessionKey_('abc!@#$%^&*() 123')).toBe('ADMIN_SESSION_abc123');
  });

  it('truncates an overlong token to 100 characters', () => {
    const app = loadCodeGs();
    const longToken = 'a'.repeat(500);
    const key = app.adminSessionKey_(longToken);
    expect(key.length).toBe('ADMIN_SESSION_'.length + 100);
  });
});

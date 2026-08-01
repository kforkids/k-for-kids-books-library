import { describe, it, expect, beforeEach } from 'vitest';
import { loadCodeGs, fakeClock } from '../support/loadGasSource.js';

describe('checkRateLimit_ (sliding-window rate limit)', () => {
  let app;

  beforeEach(() => {
    app = loadCodeGs();
  });

  it('allows the first N attempts within the window', () => {
    for (let i = 0; i < 5; i++) {
      expect(app.checkRateLimit_('login', 5, 300)).toBe(true);
    }
  });

  it('blocks the (N+1)th attempt within the same window', () => {
    for (let i = 0; i < 5; i++) app.checkRateLimit_('login', 5, 300);
    expect(app.checkRateLimit_('login', 5, 300)).toBe(false);
  });

  it('tracks separate scopes independently', () => {
    for (let i = 0; i < 5; i++) app.checkRateLimit_('login', 5, 300);
    expect(app.checkRateLimit_('login', 5, 300)).toBe(false);
    // A different scope (e.g. password-reset) has its own budget.
    expect(app.checkRateLimit_('password-reset', 5, 300)).toBe(true);
  });

  it('stashes the correct seconds-until-retry on lastRetryAfter when blocked', () => {
    // Start well above epoch 0 — see the "KNOWN BUG" test below for why a
    // window that starts at exactly timestamp 0 breaks this calculation.
    const clock = fakeClock(1_000_000);
    const timedApp = loadCodeGs({ clock });
    for (let i = 0; i < 3; i++) timedApp.checkRateLimit_('scope-a', 3, 60);
    // 10 seconds elapse, then the blocked attempt.
    clock.advance(10_000);
    const allowed = timedApp.checkRateLimit_('scope-a', 3, 60);
    expect(allowed).toBe(false);
    expect(timedApp.checkRateLimit_.lastRetryAfter).toBe(50); // 60 - 10 elapsed
  });

  it('KNOWN BUG: a window that starts at exactly timestamp 0 resets on every call', () => {
    // checkRateLimit_ reads back the stored window-start with
    // `parseInt(parts[1], 10) || now` (Code.gs:3620). When the real stored
    // value is 0, `0 || now` is truthy-falsy-coerced to `now` instead of 0,
    // so the window silently restarts on every call instead of expiring
    // after `windowSeconds`. In production this never fires in practice
    // (Date.now() is always a huge epoch value, never exactly 0), so this
    // documents a latent correctness bug rather than a live incident.
    const clock = fakeClock(0);
    const timedApp = loadCodeGs({ clock });
    for (let i = 0; i < 3; i++) timedApp.checkRateLimit_('scope-bug', 3, 60);
    clock.advance(10_000);
    timedApp.checkRateLimit_('scope-bug', 3, 60);
    // Should be 50 (60 - 10s elapsed) if windowStart were read correctly;
    // it comes back as 60 because the falsy-zero bug treats the window as
    // having just restarted at the current time.
    expect(timedApp.checkRateLimit_.lastRetryAfter).toBe(60);
  });

  it('resets lastRetryAfter to 0 immediately after an allowed attempt', () => {
    app.checkRateLimit_('scope-b', 5, 60);
    expect(app.checkRateLimit_.lastRetryAfter).toBe(0);
  });

  it('allows attempts again once the window has fully elapsed', () => {
    const clock = fakeClock(1_000_000);
    const timedApp = loadCodeGs({ clock });
    for (let i = 0; i < 3; i++) timedApp.checkRateLimit_('scope-c', 3, 60);
    expect(timedApp.checkRateLimit_('scope-c', 3, 60)).toBe(false);

    // Cache TTL means the window entry itself expires after 60s — simulate
    // that by advancing time past the window and re-checking.
    clock.advance(61_000);
    expect(timedApp.checkRateLimit_('scope-c', 3, 60)).toBe(true);
  });
});

describe('rateLimitMessage_ (human-friendly retry text)', () => {
  it('renders a seconds-based message under a minute', () => {
    const app = loadCodeGs();
    app.checkRateLimit_.lastRetryAfter = 45;
    expect(app.rateLimitMessage_('Too many login attempts.')).toBe(
      'Too many login attempts. Please try again in 45 seconds.'
    );
  });

  it('uses singular "second" for exactly 1 second', () => {
    const app = loadCodeGs();
    app.checkRateLimit_.lastRetryAfter = 1;
    expect(app.rateLimitMessage_('X.')).toBe('X. Please try again in 1 second.');
  });

  it('renders a minutes-based message at or above 60 seconds', () => {
    const app = loadCodeGs();
    app.checkRateLimit_.lastRetryAfter = 125; // rounds up to 3 minutes
    expect(app.rateLimitMessage_('X.')).toBe('X. Please try again in about 3 minutes.');
  });

  it('uses singular "minute" when it rounds to exactly 1', () => {
    const app = loadCodeGs();
    app.checkRateLimit_.lastRetryAfter = 60;
    expect(app.rateLimitMessage_('X.')).toBe('X. Please try again in about 1 minute.');
  });

  it('falls back to a default prefix when none is given', () => {
    const app = loadCodeGs();
    app.checkRateLimit_.lastRetryAfter = 10;
    expect(app.rateLimitMessage_()).toBe('Too many attempts. Please try again in 10 seconds.');
  });
});

import { describe, it, expect } from 'vitest';
import { loadCodeGs } from '../support/loadGasSource.js';
import { TEST_CUSTOMERS } from '../fixtures/books.js';

const app = loadCodeGs();

describe('parseMonthlyReservationLimit_', () => {
  it('uses the explicit monthlyReservationLimit when positive', () => {
    expect(app.parseMonthlyReservationLimit_({ monthlyReservationLimit: 5, subscriptionPlan: '12 books/month' })).toBe(5);
  });

  it('ignores a zero or negative explicit limit and falls back to the plan text', () => {
    expect(app.parseMonthlyReservationLimit_({ monthlyReservationLimit: 0, subscriptionPlan: '10 books/month' })).toBe(10);
    expect(app.parseMonthlyReservationLimit_({ monthlyReservationLimit: -3, subscriptionPlan: '10 books/month' })).toBe(10);
  });

  it('extracts the first number found in the plan name', () => {
    expect(app.parseMonthlyReservationLimit_({ subscriptionPlan: '2 books/month' })).toBe(2);
    expect(app.parseMonthlyReservationLimit_({ subscriptionPlan: 'Plan: 12 books/month (promo)' })).toBe(12);
  });

  it('returns 0 when there is no explicit limit and no number in the plan text', () => {
    expect(app.parseMonthlyReservationLimit_({ subscriptionPlan: 'Unlimited Plan' })).toBe(0);
    expect(app.parseMonthlyReservationLimit_({ subscriptionPlan: '' })).toBe(0);
  });

  it('matches against the shared customer fixtures', () => {
    const active = TEST_CUSTOMERS.find(c => c.customerId === 'C001');
    const pending = TEST_CUSTOMERS.find(c => c.customerId === 'C002');
    const planTextOnly = TEST_CUSTOMERS.find(c => c.customerId === 'C003');
    expect(app.parseMonthlyReservationLimit_(active)).toBe(5);
    expect(app.parseMonthlyReservationLimit_(pending)).toBe(0);
    expect(app.parseMonthlyReservationLimit_(planTextOnly)).toBe(12);
  });
});

describe('reservationBookKey_ (server-side book number normalization)', () => {
  it('uppercases and strips whitespace', () => {
    expect(app.reservationBookKey_(' e0001 ')).toBe('E0001');
  });

  it('is stable for values already normalized', () => {
    expect(app.reservationBookKey_('E0001')).toBe('E0001');
  });
});

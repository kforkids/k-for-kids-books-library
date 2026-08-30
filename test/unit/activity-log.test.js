import { describe, it, expect } from 'vitest';
import { loadCodeGs } from '../support/loadGasSource.js';

const app = loadCodeGs();

// Builds a minimal Activity-Log row object as pairActivityThreads_ expects it.
function row({ event, sort, bookNo = 'E0001', customerId = 'C1', reservationId = '' }) {
  return {
    idx: sort,
    sort,
    timestamp: String(sort),
    event,
    bookNo,
    bookName: 'Some book',
    customerId,
    customerName: 'Some customer',
    actor: 'admin',
    dueDate: '',
    reservationId
  };
}

describe('pairActivityThreads_', () => {
  it('pairs a RESERVED row with its later cancellation via a shared key', () => {
    const rows = [
      row({ event: 'RESERVED', sort: 1, reservationId: 'RES-1' }),
      row({ event: 'RESERVATION_CANCELLED', sort: 2, reservationId: 'RES-1' })
    ];
    const threads = app.pairActivityThreads_(
      rows,
      r => r.event === 'RESERVED',
      r => r.reservationId,
      r => r.event === 'RESERVATION_CANCELLED' || r.event === 'UNRESERVED' || r.event === 'ISSUED'
    );
    expect(threads).toHaveLength(1);
    expect(threads[0].start.event).toBe('RESERVED');
    expect(threads[0].end.event).toBe('RESERVATION_CANCELLED');
  });

  it('leaves a RESERVED row open (end: null) when nothing closes it yet', () => {
    const rows = [row({ event: 'RESERVED', sort: 1, reservationId: 'RES-1' })];
    const threads = app.pairActivityThreads_(
      rows,
      r => r.event === 'RESERVED',
      r => r.reservationId,
      r => r.event === 'RESERVATION_CANCELLED'
    );
    expect(threads).toHaveLength(1);
    expect(threads[0].end).toBeNull();
  });

  it('never reuses an end row across two starts sharing the same key', () => {
    // Same book+customer key issued and returned twice in sequence.
    const rows = [
      row({ event: 'ISSUED', sort: 1, bookNo: 'E0001', customerId: 'C1' }),
      row({ event: 'RETURNED', sort: 2, bookNo: 'E0001', customerId: 'C1' }),
      row({ event: 'ISSUED', sort: 3, bookNo: 'E0001', customerId: 'C1' }),
      row({ event: 'RETURNED', sort: 4, bookNo: 'E0001', customerId: 'C1' })
    ];
    const threads = app.pairActivityThreads_(
      rows,
      r => r.event === 'ISSUED',
      r => r.bookNo + '|' + r.customerId,
      r => r.event === 'RETURNED'
    );
    expect(threads).toHaveLength(2);
    expect(threads[0].start.sort).toBe(1);
    expect(threads[0].end.sort).toBe(2);
    expect(threads[1].start.sort).toBe(3);
    expect(threads[1].end.sort).toBe(4);
  });

  it('does not pair rows lacking a key (empty reservationId) with each other', () => {
    const rows = [
      row({ event: 'RESERVATION_CANCELLED', sort: 1, reservationId: '' }),
      row({ event: 'RESERVED', sort: 2, reservationId: '' })
    ];
    const threads = app.pairActivityThreads_(
      rows,
      r => r.event === 'RESERVED',
      r => r.reservationId,
      r => r.event === 'RESERVATION_CANCELLED'
    );
    expect(threads).toHaveLength(1);
    expect(threads[0].end).toBeNull();
  });
});

describe('formatActivityThread_', () => {
  it('computes heldDays from the sort-key difference when there is an end row', () => {
    const start = row({ event: 'ISSUED', sort: 0 });
    const end = row({ event: 'RETURNED', sort: 3 * 86400000 }); // 3 days later
    const shaped = app.formatActivityThread_({ start, end });
    expect(shaped.heldDays).toBe(3);
    expect(shaped.endEvent).toBe('RETURNED');
  });

  it('leaves heldDays null and endEvent empty when the thread is still open', () => {
    const start = row({ event: 'RESERVED', sort: 0 });
    const shaped = app.formatActivityThread_({ start, end: null });
    expect(shaped.heldDays).toBeNull();
    expect(shaped.endEvent).toBe('');
    expect(shaped.endAt).toBe('');
  });
});

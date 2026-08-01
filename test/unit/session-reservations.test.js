import { describe, it, expect } from 'vitest';
import { loadCodeGs } from '../support/loadGasSource.js';

// addSessionReservation_/removeSessionReservation_ delegate to
// getSessionReservations_, which short-circuits with ZERO Apps Script calls
// when sessionCustomer.reservations is already an array (a warm session
// cache) — that's the scenario exercised here. When it's cold, it falls
// through to a sheet scan (getActiveReservationsForCustomer_), which is out
// of scope for these tests (see catalog notes).

function warmSession(reservations = []) {
  return { customerId: 'C001', reservations };
}

describe('addSessionReservation_ (dedup-by-bookNo insert)', () => {
  it('adds a new reservation to an empty cached list', () => {
    const app = loadCodeGs();
    const session = warmSession([]);
    const result = app.addSessionReservation_('tok', session, {
      reservationId: 'R-1', bookNo: 'E0001', bookName: 'The Gruffalo'
    });
    expect(result).toEqual([{ reservationId: 'R-1', bookNo: 'E0001', bookName: 'The Gruffalo' }]);
  });

  it('does not add a duplicate when the bookNo is already reserved (idempotent)', () => {
    const app = loadCodeGs();
    const session = warmSession([{ reservationId: 'R-1', bookNo: 'E0001', bookName: 'The Gruffalo' }]);
    const result = app.addSessionReservation_('tok', session, {
      reservationId: 'R-2', bookNo: 'E0001', bookName: 'The Gruffalo (retry)'
    });
    expect(result).toHaveLength(1);
    expect(result[0].reservationId).toBe('R-1'); // original entry wins, not overwritten
  });

  it('trims whitespace on bookNo before comparing for dedup', () => {
    const app = loadCodeGs();
    const session = warmSession([{ reservationId: 'R-1', bookNo: 'E0001', bookName: 'The Gruffalo' }]);
    const result = app.addSessionReservation_('tok', session, {
      reservationId: 'R-2', bookNo: '  E0001  ', bookName: 'dup'
    });
    expect(result).toHaveLength(1);
  });

  it('appends alongside existing reservations for other books', () => {
    const app = loadCodeGs();
    const session = warmSession([{ reservationId: 'R-1', bookNo: 'E0001', bookName: 'The Gruffalo' }]);
    const result = app.addSessionReservation_('tok', session, {
      reservationId: 'R-2', bookNo: 'E0002', bookName: 'Matilda'
    });
    expect(result).toHaveLength(2);
    expect(result.map(r => r.bookNo)).toEqual(['E0001', 'E0002']);
  });
});

describe('removeSessionReservation_ (remove by reservationId or bookNo)', () => {
  const twoReservations = () => warmSession([
    { reservationId: 'R-1', bookNo: 'E0001', bookName: 'The Gruffalo' },
    { reservationId: 'R-2', bookNo: 'E0002', bookName: 'Matilda' }
  ]);

  it('removes the matching entry by reservationId', () => {
    const app = loadCodeGs();
    const result = app.removeSessionReservation_('tok', twoReservations(), 'R-1', '');
    expect(result).toHaveLength(1);
    expect(result[0].bookNo).toBe('E0002');
  });

  it('removes the matching entry by bookNo when reservationId is not given', () => {
    const app = loadCodeGs();
    const result = app.removeSessionReservation_('tok', twoReservations(), '', 'E0002');
    expect(result).toHaveLength(1);
    expect(result[0].bookNo).toBe('E0001');
  });

  it('removes nothing when neither reservationId nor bookNo is provided', () => {
    const app = loadCodeGs();
    const result = app.removeSessionReservation_('tok', twoReservations(), '', '');
    expect(result).toHaveLength(2);
  });

  it('removes nothing when the given identifiers do not match any entry', () => {
    const app = loadCodeGs();
    const result = app.removeSessionReservation_('tok', twoReservations(), 'R-999', 'E9999');
    expect(result).toHaveLength(2);
  });
});

describe('addSessionReservation_ + removeSessionReservation_ persist through the fake CacheService', () => {
  it('a later getSessionReservations_ call (cold-path bypassed via warm cache) reflects the mutation', () => {
    const app = loadCodeGs();
    const session = warmSession([]);
    app.addSessionReservation_('tok', session, { reservationId: 'R-1', bookNo: 'E0001', bookName: 'The Gruffalo' });
    // setSessionReservations_ persists via CacheService under the token's session key.
    const cache = app.CacheService.getScriptCache();
    const raw = cache.get(app.customerSessionKey_('tok'));
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).reservations).toEqual([{ reservationId: 'R-1', bookNo: 'E0001', bookName: 'The Gruffalo' }]);
  });
});

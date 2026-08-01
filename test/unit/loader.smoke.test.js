import { describe, it, expect } from 'vitest';
import { loadCodeGs, loadIndexHtmlScript } from '../support/loadGasSource.js';

describe('loader smoke test', () => {
  it('loads real Code.gs source and exposes its functions', () => {
    const sandbox = loadCodeGs();
    expect(typeof sandbox.trim_).toBe('function');
    expect(typeof sandbox.parseMonthlyReservationLimit_).toBe('function');
    expect(sandbox.trim_('  hi  ')).toBe('hi');
  });

  it('loads real Index.html inline script and exposes its functions', () => {
    const sandbox = loadIndexHtmlScript();
    expect(typeof sandbox.isValidEmail_).toBe('function');
    expect(sandbox.isValidEmail_('a@b.com')).toBe(true);
  });

  it('documents a Node vm gotcha: assigning a property on the returned object does NOT change a top-level `let` binding the script reads internally — use app.run() instead', () => {
    const sandbox = loadIndexHtmlScript();
    sandbox.adminMode = true; // looks like it should work; does not
    expect(sandbox.run('adminMode')).toBe(false); // the real binding never moved
    sandbox.run('adminMode = true'); // mutating it FROM INSIDE the same context does work
    expect(sandbox.run('adminMode')).toBe(true);
  });
});

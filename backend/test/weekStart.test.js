import { expect } from 'chai';
import { weekStartISO } from '../utils/week.js';

describe('weekStartISO', () => {
  it('returns Monday for a date that is Monday', () => {
    const monday = '2025-11-24'; // Monday
    const res = weekStartISO(monday);
    expect(res).to.equal('2025-11-24');
  });

  it('returns Monday for a date that is Wednesday', () => {
    const wed = '2025-11-26'; // Wednesday
    const res = weekStartISO(wed);
    expect(res).to.equal('2025-11-24');
  });

  it('returns the proper Monday across month boundary', () => {
    const date = '2025-12-02'; // Tuesday Dec 2, 2025 - week start should be Mon Dec 1 2025
    const res = weekStartISO(date);
    expect(res).to.equal('2025-12-01');
  });

  it('returns null for invalid input', () => {
    const res = weekStartISO(null);
    expect(res).to.equal(null);
  });
});

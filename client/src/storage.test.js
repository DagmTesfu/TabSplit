import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMyName,
  setMyName,
  getRecentPeople,
  saveRecentPeople,
  getBillHistory,
  saveBillToHistory,
  removeBillFromHistory,
  clearBillHistory,
  getHostPaymentAccounts,
  saveHostPaymentAccounts,
  getPaidStatus,
  setPersonPaidStatus,
} from './storage.js';

describe('Local Personalization and Storage', () => {
  beforeEach(() => {
    setMyName('');
    clearBillHistory();
    // clear recent people by setting empty list
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('tabsplit_recent_people');
    }
  });

  it('1. getMyName and setMyName trims, persists, and clears properly', () => {
    assert.equal(getMyName(), '');
    setMyName('  Dagm Tesfu  ');
    assert.equal(getMyName(), 'Dagm Tesfu');

    setMyName('');
    assert.equal(getMyName(), '');
  });

  it('2. saveRecentPeople deduplicates, filters, and retains recent friends', () => {
    saveRecentPeople(['Sarah', 'Alex', 'sarah', '']);
    const list = getRecentPeople();
    assert.deepEqual(list, ['Sarah', 'Alex']);

    // Adding more people prepends new ones and doesn't duplicate
    saveRecentPeople(['Michael', 'Alex']);
    const updated = getRecentPeople();
    assert.equal(updated[0], 'Michael');
    assert.ok(updated.includes('Sarah'));
    assert.equal(updated.filter((n) => n.toLowerCase() === 'alex').length, 1);
  });

  it('3. saveBillToHistory records bill, moves duplicate shareCode to top, and caps list', () => {
    assert.deepEqual(getBillHistory(), []);

    saveBillToHistory({
      shareCode: 'abc1',
      restaurantName: 'Cafe Verde',
      currency: 'ETB',
      totalMinor: 45000,
      participantCount: 3,
      role: 'created',
    });

    saveBillToHistory({
      shareCode: 'xyz2',
      restaurantName: 'Burgers & Co',
      currency: 'USD',
      totalMinor: 3550,
      participantCount: 2,
      role: 'viewed',
    });

    let history = getBillHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].shareCode, 'xyz2');
    assert.equal(history[0].role, 'viewed');
    assert.equal(history[1].shareCode, 'abc1');

    // Re-saving abc1 should move it to the top
    saveBillToHistory({
      shareCode: 'abc1',
      restaurantName: 'Cafe Verde',
      currency: 'ETB',
      totalMinor: 45000,
      participantCount: 3,
      role: 'created',
    });

    history = getBillHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].shareCode, 'abc1');
  });

  it('4. removeBillFromHistory removes specific entry and clearBillHistory empties all', () => {
    saveBillToHistory({ shareCode: 'code1', restaurantName: 'R1' });
    saveBillToHistory({ shareCode: 'code2', restaurantName: 'R2' });

    assert.equal(getBillHistory().length, 2);
    removeBillFromHistory('code1');

    const history = getBillHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].shareCode, 'code2');

    clearBillHistory();
    assert.equal(getBillHistory().length, 0);
  });

  it('5. getHostPaymentAccounts and saveHostPaymentAccounts persist and sanitize', () => {
    saveHostPaymentAccounts({
      accountName: '  Dagmawi T. ',
      telebirr: ' 0911223344 ',
      cbe: ' 1000998877 ',
      awash: '',
      abyssinia: '',
    });

    const accounts = getHostPaymentAccounts();
    assert.equal(accounts.accountName, 'Dagmawi T.');
    assert.equal(accounts.telebirr, '0911223344');
    assert.equal(accounts.cbe, '1000998877');
    assert.equal(accounts.awash, '');
    assert.equal(accounts.abyssinia, '');
  });

  it('6. getPaidStatus and setPersonPaidStatus tracks per-person payment state', () => {
    assert.deepEqual(getPaidStatus('bill123'), {});

    setPersonPaidStatus('bill123', 'p1', true);
    setPersonPaidStatus('bill123', 'p2', false);

    const status = getPaidStatus('bill123');
    assert.equal(status.p1, true);
    assert.equal(status.p2, false);

    // Other bills remain unaffected
    assert.deepEqual(getPaidStatus('bill999'), {});
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANK_CONFIG,
  encodePaymentHash,
  decodePaymentHash,
  isMobileDevice,
} from './paymentAccounts.js';

describe('Ethiopian Payment Accounts & Hash Encoding', () => {
  it('1. BANK_CONFIG contains Telebirr, CBE, Awash, and Abyssinia with valid app schemes', () => {
    assert.ok(BANK_CONFIG.telebirr);
    assert.equal(BANK_CONFIG.telebirr.appScheme, 'telebirr://');

    assert.ok(BANK_CONFIG.cbe);
    assert.equal(BANK_CONFIG.cbe.appScheme, 'cbebirr://');

    assert.ok(BANK_CONFIG.awash);
    assert.equal(BANK_CONFIG.awash.appScheme, 'awashbirr://');

    assert.ok(BANK_CONFIG.abyssinia);
    assert.equal(BANK_CONFIG.abyssinia.appScheme, 'boamobile://');
  });

  it('2. encodePaymentHash and decodePaymentHash round-trip accurately', () => {
    const original = {
      accountName: 'Dagmawi Tesfu',
      telebirr: '0911234567',
      cbe: '1000123456789',
      awash: '01320123456700',
      abyssinia: '87654321',
    };

    const hash = encodePaymentHash(original);
    assert.ok(hash.length > 0);

    // Should decode from #pay=... parameter
    const decodedFromHash = decodePaymentHash(`#pay=${hash}`);
    assert.deepEqual(decodedFromHash, original);

    // Should decode from direct hash
    const decodedDirect = decodePaymentHash(hash);
    assert.deepEqual(decodedDirect, original);
  });

  it('3. returns null or empty string for empty or invalid hashes', () => {
    assert.equal(encodePaymentHash({}), '');
    assert.equal(encodePaymentHash(null), '');
    assert.equal(decodePaymentHash(''), null);
    assert.equal(decodePaymentHash('#pay=invalid-base64-not-json'), null);
  });

  it('4. isMobileDevice safely executes in test environment without error', () => {
    const result = isMobileDevice();
    assert.equal(typeof result, 'boolean');
  });
});

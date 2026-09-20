import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function currencySymbol(currency) {
  if (currency === 'USD') return '$';
  if (currency === 'ETB') return 'ETB ';
  return `${currency} `;
}

// Format signed priceMinor (integer cents/santim) to a display string with currency symbol.
// E.g. 1695 with "USD" → "$16.95", -599 with "USD" → "-$5.99".
// 4000 with "ETB" → "ETB 40.00", -500 with "ETB" → "-ETB 5.00".
function formatAmount(priceMinor, currency) {
  const minorUnits = 2;
  const isNegative = priceMinor < 0;
  const absMinor = Math.abs(priceMinor);
  const major = Math.floor(absMinor / 10 ** minorUnits);
  const minor = absMinor % 10 ** minorUnits;
  const formatted = `${major}.${String(minor).padStart(minorUnits, '0')}`;
  const sym = currencySymbol(currency);
  return isNegative ? `-${sym}${formatted}` : `${sym}${formatted}`;
}

export default function ReviewPage() {
  const location = useLocation();
  const receipt = location.state?.receipt;

  if (!receipt) {
    return (
      <div className="page page-center">
        <h1 className="title">No Receipt to Review</h1>
        <p className="subtitle">
          Scan a receipt first to review the extracted items.
        </p>
        <Link to="/scan" className="btn-primary">
          Go to Scanner
        </Link>
      </div>
    );
  }

  const {
    restaurantName,
    currency,
    items = [],
    taxMinor = 0,
    taxInclusive = false,
    tipMinor = 0,
    additionalCharges = [],
    totalMinor: serverTotalMinor,
  } = receipt;

  const itemsSubtotalMinor = items.reduce((sum, item) => sum + item.priceMinor, 0);
  const chargesMinor = additionalCharges.reduce((sum, c) => sum + (c.amountMinor || 0), 0);
  const finalTotalMinor =
    serverTotalMinor !== undefined
      ? serverTotalMinor
      : itemsSubtotalMinor + (taxInclusive ? 0 : taxMinor) + tipMinor + chargesMinor;

  return (
    <div className="page">
      <h1 className="title">Review Receipt</h1>

      {restaurantName && (
        <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>
          {restaurantName}
        </p>
      )}
      <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
        {items.length} item{items.length !== 1 ? 's' : ''} · {currency}
      </p>

      {/* Items List */}
      <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
        {items.map((item, index) => (
          <li
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <span style={{ flex: 1, marginRight: 12 }}>
              {item.quantity && item.quantity > 1 ? `${item.quantity} × ` : ''}
              {item.name}
            </span>
            <span
              style={{
                fontWeight: 600,
                whiteSpace: 'nowrap',
                color: item.priceMinor < 0 ? '#16a34a' : 'inherit',
              }}
            >
              {formatAmount(item.priceMinor, currency)}
            </span>
          </li>
        ))}
      </ul>

      {/* Breakdown & Summary */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            color: 'var(--text-muted)',
            fontSize: '0.95rem',
          }}
        >
          <span>Items subtotal</span>
          <span>{formatAmount(itemsSubtotalMinor, currency)}</span>
        </div>

        {additionalCharges.map((charge, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
            }}
          >
            <span>{charge.name}</span>
            <span>{formatAmount(charge.amountMinor, currency)}</span>
          </div>
        ))}

        {taxMinor > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
            }}
          >
            <span>{taxInclusive ? 'Includes Tax/VAT' : 'Tax'}</span>
            <span>{formatAmount(taxMinor, currency)}</span>
          </div>
        )}

        {tipMinor > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
            }}
          >
            <span>Tip</span>
            <span>{formatAmount(tipMinor, currency)}</span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 12,
            marginTop: 8,
            borderTop: '2px solid var(--text-main)',
            fontWeight: 700,
            fontSize: '1.15rem',
          }}
        >
          <span>Total</span>
          <span>{formatAmount(finalTotalMinor, currency)}</span>
        </div>
      </div>

      <Link to="/scan" className="btn-secondary" style={{ alignSelf: 'center', marginTop: 12 }}>
        ← Scan Another Receipt
      </Link>
    </div>
  );
}

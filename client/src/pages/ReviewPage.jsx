import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Format priceMinor (integer cents/santim) to a display string.
// E.g. 1695 with currency "USD" → "16.95", 4000 with "ETB" → "40.00".
// Both ETB and USD use 2 minor units.
function formatPrice(priceMinor, currency) {
  const minorUnits = 2;
  const major = Math.floor(priceMinor / 10 ** minorUnits);
  const minor = priceMinor % 10 ** minorUnits;
  return `${major}.${String(minor).padStart(minorUnits, '0')}`;
}

function currencySymbol(currency) {
  if (currency === 'USD') return '$';
  if (currency === 'ETB') return 'ETB ';
  return `${currency} `;
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
    tipMinor = 0,
    additionalCharges = [],
    totalMinor: serverTotalMinor,
  } = receipt;

  const sym = currencySymbol(currency);
  const itemsSubtotalMinor = items.reduce((sum, item) => sum + item.priceMinor, 0);
  const finalTotalMinor =
    serverTotalMinor !== undefined
      ? serverTotalMinor
      : itemsSubtotalMinor +
        taxMinor +
        tipMinor +
        additionalCharges.reduce((sum, c) => sum + (c.amountMinor || 0), 0);

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
            <span style={{ flex: 1, marginRight: 12 }}>{item.name}</span>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
              {sym}{formatPrice(item.priceMinor, currency)}
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
          <span>{sym}{formatPrice(itemsSubtotalMinor, currency)}</span>
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
            <span>{sym}{formatPrice(charge.amountMinor, currency)}</span>
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
            <span>Tax</span>
            <span>{sym}{formatPrice(taxMinor, currency)}</span>
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
            <span>{sym}{formatPrice(tipMinor, currency)}</span>
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
          <span>{sym}{formatPrice(finalTotalMinor, currency)}</span>
        </div>
      </div>

      <Link to="/scan" className="btn-secondary" style={{ alignSelf: 'center', marginTop: 12 }}>
        ← Scan Another Receipt
      </Link>
    </div>
  );
}

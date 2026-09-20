import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function currencySymbol(currency) {
  if (currency === 'USD') return '$';
  if (currency === 'ETB') return 'ETB ';
  return `${currency} `;
}

function minorToDecimalStr(minorUnits) {
  if (minorUnits === undefined || minorUnits === null || Number.isNaN(minorUnits)) return '0.00';
  const isNegative = minorUnits < 0;
  const abs = Math.abs(minorUnits);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const str = `${major}.${String(minor).padStart(2, '0')}`;
  return isNegative ? `-${str}` : str;
}

// Convert user decimal string input (e.g. "16.95", "-5.99") into exact integer minor units
function parseSignedMinor(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : 0;
  if (!value || typeof value !== 'string') return 0;
  let text = value.trim().replace(/[$€£]/g, '').trim();
  let isNegative = false;
  if (text.startsWith('-')) {
    isNegative = true;
    text = text.slice(1).trim();
  } else if (text.startsWith('+')) {
    text = text.slice(1).trim();
  }
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(text)) return 0;
  const [units = '0', fraction = ''] = text.split('.');
  const fracDigits = fraction.slice(0, 2).padEnd(2, '0');
  const total = parseInt(units || '0', 10) * 100 + parseInt(fracDigits || '0', 10);
  if (!Number.isSafeInteger(total)) return 0;
  return isNegative ? -total : total;
}

function parseNonNegativeMinor(value) {
  return Math.max(0, parseSignedMinor(value));
}

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

const inputBaseStyle = {
  padding: '8px 10px',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  fontSize: '0.95rem',
  color: 'var(--text-main)',
  backgroundColor: '#ffffff',
  outline: 'none',
  transition: 'border-color 0.15s ease',
};

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

  // Local editable receipt state
  const [restaurantName, setRestaurantName] = useState(() => receipt.restaurantName ?? '');
  const [items, setItems] = useState(() =>
    Array.isArray(receipt.items)
      ? receipt.items.map((item) => ({
          name: item.name ?? '',
          quantity: typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1,
          priceStr: minorToDecimalStr(item.priceMinor ?? 0),
        }))
      : []
  );
  const [taxStr, setTaxStr] = useState(() => minorToDecimalStr(receipt.taxMinor ?? 0));
  const [taxInclusive, setTaxInclusive] = useState(() => Boolean(receipt.taxInclusive));
  const [tipStr, setTipStr] = useState(() => minorToDecimalStr(receipt.tipMinor ?? 0));
  const [additionalCharges, setAdditionalCharges] = useState(() =>
    Array.isArray(receipt.additionalCharges)
      ? receipt.additionalCharges.map((charge) => ({
          name: charge.name ?? '',
          amountStr: minorToDecimalStr(charge.amountMinor ?? 0),
        }))
      : []
  );

  // Preserved receipt context
  const currency = receipt.currency ?? 'USD';
  const printedTotalMinor = receipt.printedTotalMinor ?? null;

  // Change handlers
  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleChargeChange = (index, field, value) => {
    setAdditionalCharges((prev) =>
      prev.map((charge, idx) => (idx === index ? { ...charge, [field]: value } : charge))
    );
  };

  // Live integer totals derived from local state
  const itemsSubtotalMinor = items.reduce(
    (sum, item) => sum + parseSignedMinor(item.priceStr),
    0
  );
  const chargesMinor = additionalCharges.reduce(
    (sum, c) => sum + parseNonNegativeMinor(c.amountStr),
    0
  );
  const taxMinor = parseNonNegativeMinor(taxStr);
  const tipMinor = parseNonNegativeMinor(tipStr);
  const previewTotalMinor =
    itemsSubtotalMinor + (taxInclusive ? 0 : taxMinor) + tipMinor + chargesMinor;

  return (
    <div className="page">
      <h1 className="title">Review Receipt</h1>

      {/* Restaurant Name Input */}
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="restaurant-name-input"
          style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Restaurant Name
        </label>
        <input
          id="restaurant-name-input"
          type="text"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          placeholder="Restaurant name"
          style={{ ...inputBaseStyle, width: '100%', fontSize: '1.05rem', fontWeight: 600 }}
        />
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.9rem' }}>
        {items.length} item{items.length !== 1 ? 's' : ''} · {currency}
      </p>

      {/* Items List */}
      <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
        {items.map((item, index) => {
          const itemPriceMinor = parseSignedMinor(item.priceStr);
          const isNegative = itemPriceMinor < 0;

          return (
            <li
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 0',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              {/* Quantity input */}
              <input
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  handleItemChange(index, 'quantity', Number.isNaN(val) || val < 1 ? 1 : val);
                }}
                aria-label={`Item ${index + 1} quantity`}
                style={{
                  ...inputBaseStyle,
                  width: '46px',
                  textAlign: 'center',
                  padding: '8px 4px',
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>×</span>

              {/* Name input */}
              <input
                type="text"
                value={item.name}
                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                aria-label={`Item ${index + 1} name`}
                placeholder="Item name"
                style={{ ...inputBaseStyle, flex: 1, minWidth: 0 }}
              />

              {/* Price input */}
              <input
                type="text"
                inputMode="decimal"
                value={item.priceStr}
                onChange={(e) => handleItemChange(index, 'priceStr', e.target.value)}
                aria-label={`Item ${index + 1} price`}
                placeholder="0.00"
                style={{
                  ...inputBaseStyle,
                  width: '84px',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: isNegative ? '#16a34a' : 'inherit',
                }}
              />
            </li>
          );
        })}
      </ul>

      {/* Breakdown & Summary */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: 14,
          marginBottom: 20,
        }}
      >
        {/* Items Subtotal */}
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
          <span style={{ fontWeight: 600 }}>{formatAmount(itemsSubtotalMinor, currency)}</span>
        </div>

        {/* Additional Charges */}
        {additionalCharges.map((charge, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
            }}
          >
            <input
              type="text"
              value={charge.name}
              onChange={(e) => handleChargeChange(index, 'name', e.target.value)}
              placeholder="Charge name"
              aria-label={`Additional charge ${index + 1} name`}
              style={{ ...inputBaseStyle, flex: 1, fontSize: '0.9rem' }}
            />
            <input
              type="text"
              inputMode="decimal"
              value={charge.amountStr}
              onChange={(e) => handleChargeChange(index, 'amountStr', e.target.value)}
              placeholder="0.00"
              aria-label={`Additional charge ${index + 1} amount`}
              style={{
                ...inputBaseStyle,
                width: '84px',
                textAlign: 'right',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            />
          </div>
        ))}

        {/* Tax Section */}
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-color)', marginTop: 6 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Tax</span>
            <input
              type="text"
              inputMode="decimal"
              value={taxStr}
              onChange={(e) => setTaxStr(e.target.value)}
              placeholder="0.00"
              aria-label="Tax amount"
              style={{
                ...inputBaseStyle,
                width: '84px',
                textAlign: 'right',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            />
          </div>

          {/* Tax-inclusive toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginTop: 6,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={taxInclusive}
              onChange={(e) => setTaxInclusive(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--primary-color)' }}
            />
            <span>Tax already included in item prices</span>
          </label>

          {taxInclusive && taxMinor > 0 && (
            <p style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: 4 }}>
              (Includes {formatAmount(taxMinor, currency)} tax/VAT — not added to total)
            </p>
          )}
        </div>

        {/* Tip Section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            padding: '8px 0',
          }}
        >
          <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Tip</span>
          <input
            type="text"
            inputMode="decimal"
            value={tipStr}
            onChange={(e) => setTipStr(e.target.value)}
            placeholder="0.00"
            aria-label="Tip amount"
            style={{
              ...inputBaseStyle,
              width: '84px',
              textAlign: 'right',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          />
        </div>

        {/* Live Total */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 12,
            marginTop: 8,
            borderTop: '2px solid var(--text-main)',
            fontWeight: 700,
            fontSize: '1.2rem',
          }}
        >
          <span>Total</span>
          <span>{formatAmount(previewTotalMinor, currency)}</span>
        </div>

        {/* Observed OCR Total metadata */}
        {printedTotalMinor !== null && (
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginTop: 6,
              textAlign: 'right',
            }}
          >
            Receipt total: {formatAmount(printedTotalMinor, currency)}
          </p>
        )}
      </div>

      <Link to="/scan" className="btn-secondary" style={{ alignSelf: 'center', marginTop: 12 }}>
        ← Scan Another Receipt
      </Link>
    </div>
  );
}

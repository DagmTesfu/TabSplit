import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

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
  padding: '10px 10px',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  fontSize: '1rem',
  color: 'var(--text-main)',
  backgroundColor: '#ffffff',
  outline: 'none',
  minHeight: '40px',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
};

let nextIdCounter = 0;
function createId(prefix = 'id') {
  nextIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextIdCounter}`;
}

export default function ReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
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

  // Local editable receipt state with stable IDs
  const [restaurantName, setRestaurantName] = useState(() => receipt.restaurantName ?? '');
  const [items, setItems] = useState(() =>
    Array.isArray(receipt.items)
      ? receipt.items.map((item, idx) => ({
          id: item.id || createId(`item-${idx}`),
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
      ? receipt.additionalCharges.map((charge, idx) => ({
          id: charge.id || createId(`charge-${idx}`),
          name: charge.name ?? '',
          amountStr: minorToDecimalStr(charge.amountMinor ?? 0),
        }))
      : []
  );

  // Preserved receipt context
  const currency = receipt.currency ?? 'USD';
  const printedTotalMinor = receipt.printedTotalMinor ?? null;

  // Amount help modal and validation error states
  const [showAmountHelp, setShowAmountHelp] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // Change handlers
  const handleItemChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: createId('item'),
        name: '',
        quantity: 1,
        priceStr: '0.00',
      },
    ]);
  };

  const handleDeleteItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleChargeChange = (id, field, value) => {
    setAdditionalCharges((prev) =>
      prev.map((charge) => (charge.id === id ? { ...charge, [field]: value } : charge))
    );
  };

  const handleAddCharge = () => {
    setAdditionalCharges((prev) => [
      ...prev,
      {
        id: createId('charge'),
        name: '',
        amountStr: '0.00',
      },
    ]);
  };

  const handleDeleteCharge = (id) => {
    setAdditionalCharges((prev) => prev.filter((charge) => charge.id !== id));
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

  const handleContinue = () => {
    if (items.length === 0) {
      setReviewError('Please add at least one item before continuing.');
      return;
    }
    setReviewError(null);
    const confirmedReceipt = {
      restaurantName: (restaurantName || '').trim(),
      currency,
      items: items.map((item, idx) => ({
        id: item.id || `item-${idx + 1}`,
        name: (item.name || '').trim() || `Item ${idx + 1}`,
        quantity:
          typeof item.quantity === 'number' && item.quantity >= 1
            ? item.quantity
            : Math.max(1, parseInt(item.quantity, 10) || 1),
        priceMinor: parseSignedMinor(item.priceStr),
      })),
      taxMinor,
      taxInclusive,
      tipMinor,
      additionalCharges: additionalCharges.map((charge, idx) => ({
        id: charge.id || `charge-${idx + 1}`,
        name: (charge.name || '').trim() || `Charge ${idx + 1}`,
        amountMinor: parseNonNegativeMinor(charge.amountStr),
      })),
      printedTotalMinor,
    };
    navigate('/people', { state: { receipt: confirmedReceipt } });
  };

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

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
          {items.length} item{items.length !== 1 ? 's' : ''} · {currency}
        </p>
        <button
          type="button"
          onClick={() => setShowAmountHelp(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary-color)',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
            padding: '6px 8px',
            minHeight: '36px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: '4px',
            touchAction: 'manipulation',
          }}
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>ⓘ</span>
          <span>How to enter amounts</span>
        </button>
      </div>

      {/* Items List */}
      <ul style={{ listStyle: 'none', padding: 0, marginBottom: 12 }}>
        {items.map((item, index) => {
          const itemPriceMinor = parseSignedMinor(item.priceStr);
          const isNegative = itemPriceMinor < 0;

          return (
            <li
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 0',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              {/* Quantity input */}
              <input
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  handleItemChange(item.id, 'quantity', Number.isNaN(val) || val < 1 ? 1 : val);
                }}
                aria-label={`Item ${index + 1} quantity`}
                style={{
                  ...inputBaseStyle,
                  width: '42px',
                  textAlign: 'center',
                  padding: '8px 2px',
                  flexShrink: 0,
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0 }}>×</span>

              {/* Name input */}
              <input
                type="text"
                value={item.name}
                onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                aria-label={`Item ${index + 1} name`}
                placeholder="Item name"
                style={{ ...inputBaseStyle, flex: 1, minWidth: 0 }}
              />

              {/* Price input */}
              <input
                type="text"
                inputMode="decimal"
                value={item.priceStr}
                onChange={(e) => handleItemChange(item.id, 'priceStr', e.target.value)}
                aria-label={`Item ${index + 1} price`}
                placeholder="0.00"
                style={{
                  ...inputBaseStyle,
                  width: '76px',
                  textAlign: 'right',
                  fontWeight: 600,
                  flexShrink: 0,
                  color: isNegative ? '#16a34a' : 'inherit',
                }}
              />

              {/* Delete item button */}
              <button
                type="button"
                onClick={() => handleDeleteItem(item.id)}
                aria-label={`Delete item ${item.name || index + 1}`}
                title="Delete item"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '8px 6px',
                  borderRadius: '6px',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '40px',
                  minWidth: '32px',
                  flexShrink: 0,
                  touchAction: 'manipulation',
                }}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      {/* Add Item Button */}
      <button
        type="button"
        onClick={handleAddItem}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '10px 14px',
          minHeight: '44px',
          backgroundColor: '#eff6ff',
          color: 'var(--primary-color)',
          fontSize: '0.95rem',
          fontWeight: 600,
          border: '1px dashed #bfdbfe',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: 20,
          width: '100%',
          touchAction: 'manipulation',
        }}
      >
        + Add item
      </button>

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
            key={charge.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 6,
              padding: '4px 0',
            }}
          >
            <input
              type="text"
              value={charge.name}
              onChange={(e) => handleChargeChange(charge.id, 'name', e.target.value)}
              placeholder="Charge name"
              aria-label={`Additional charge ${index + 1} name`}
              style={{ ...inputBaseStyle, flex: 1, minWidth: 0 }}
            />
            <input
              type="text"
              inputMode="decimal"
              value={charge.amountStr}
              onChange={(e) => handleChargeChange(charge.id, 'amountStr', e.target.value)}
              placeholder="0.00"
              aria-label={`Additional charge ${index + 1} amount`}
              style={{
                ...inputBaseStyle,
                width: '76px',
                textAlign: 'right',
                fontWeight: 600,
                flexShrink: 0,
              }}
            />
            <button
              type="button"
              onClick={() => handleDeleteCharge(charge.id)}
              aria-label={`Delete additional charge ${charge.name || index + 1}`}
              title="Delete charge"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px 6px',
                borderRadius: '6px',
                fontSize: '1.1rem',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '40px',
                minWidth: '32px',
                flexShrink: 0,
                touchAction: 'manipulation',
              }}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Add Additional Charge Button */}
        <button
          type="button"
          onClick={handleAddCharge}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 12px',
            minHeight: '38px',
            backgroundColor: '#f8fafc',
            color: 'var(--primary-color)',
            fontSize: '0.9rem',
            fontWeight: 600,
            border: '1px dashed var(--border-color)',
            borderRadius: '6px',
            cursor: 'pointer',
            marginTop: 6,
            marginBottom: 6,
            touchAction: 'manipulation',
          }}
        >
          + Add charge
        </button>

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
                fontWeight: 600,
                flexShrink: 0,
              }}
            />
          </div>

          {/* Tax-inclusive toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginTop: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={taxInclusive}
              onChange={(e) => setTaxInclusive(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--primary-color)', marginTop: 2, flexShrink: 0 }}
            />
            <span>Tax already included in item prices</span>
          </label>

          {taxInclusive && taxMinor > 0 && (
            <p style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: 4, paddingLeft: 26 }}>
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
              fontWeight: 600,
              flexShrink: 0,
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

      {reviewError && (
        <div
          role="alert"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          {reviewError}
        </div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        className="btn-primary"
        style={{ marginBottom: 12 }}
      >
        Continue
      </button>

      <Link to="/scan" className="btn-secondary" style={{ alignSelf: 'center' }}>
        ← Scan Another Receipt
      </Link>

      {/* How to enter amounts Modal / Bottom Sheet */}
      {showAmountHelp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="amount-help-title"
          onClick={() => setShowAmountHelp(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 0,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '20px 16px',
              boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.15)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 id="amount-help-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                How to enter amounts
              </h2>
              <button
                type="button"
                onClick={() => setShowAmountHelp(false)}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '8px 10px',
                  minHeight: '44px',
                  minWidth: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  touchAction: 'manipulation',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: 16 }}>
              Enter the amount exactly as it appears on your receipt.
            </p>

            <div
              style={{
                backgroundColor: 'var(--bg-color)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: 16,
                fontSize: '0.9rem',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Examples
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <li>
                  <code style={{ fontWeight: 600 }}>600</code> → 600 {currency}
                </li>
                <li>
                  <code style={{ fontWeight: 600 }}>600.50</code> → 600.50 {currency}
                </li>
                <li>
                  <code style={{ fontWeight: 600 }}>12.99</code> → 12.99 {currency}
                </li>
                <li>
                  <code style={{ fontWeight: 600 }}>-5.99</code> → discount of 5.99 {currency}
                </li>
              </ul>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
              You don't need to convert amounts into cents.
            </p>

            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: 20,
                fontSize: '0.9rem',
                color: '#1e3a8a',
              }}
            >
              <strong>Discounts:</strong> If your receipt shows a discount such as <code>-5.99</code>, keep the <code>-</code> sign.
            </div>

            <button
              type="button"
              onClick={() => setShowAmountHelp(false)}
              className="btn-primary"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

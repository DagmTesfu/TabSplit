import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBill } from '../api';

function currencySymbol(currency) {
  if (currency === 'USD') return '$';
  if (currency === 'ETB') return 'ETB ';
  return `${currency} `;
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

export default function BillPage() {
  const { shareCode } = useParams();
  const [billData, setBillData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBill = useCallback(async () => {
    if (!shareCode) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBill(shareCode);
      setBillData(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [shareCode]);

  useEffect(() => {
    fetchBill();
  }, [fetchBill]);

  // Loading State
  if (loading) {
    return (
      <div className="page page-center">
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div
            style={{
              fontSize: '2rem',
              marginBottom: 12,
              animation: 'spin 1s linear infinite',
            }}
          >
            ⏳
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
            Loading bill...
          </p>
        </div>
      </div>
    );
  }

  // Not Found State (404)
  if (error && (error.status === 404 || error.code === 'BILL_NOT_FOUND')) {
    return (
      <div className="page page-center">
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
        <h1 className="title">Bill Not Found</h1>
        <p className="subtitle">
          This bill does not exist or the link may be invalid.
        </p>
        <Link to="/scan" className="btn-primary">
          Scan a Receipt
        </Link>
      </div>
    );
  }

  // General Error State
  if (error || !billData) {
    return (
      <div className="page page-center">
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
        <h1 className="title">Unable to Load Bill</h1>
        <p className="subtitle">
          {error?.message || 'A network error occurred while loading this bill.'}
        </p>
        <button
          type="button"
          onClick={fetchBill}
          className="btn-primary"
          style={{ marginBottom: 12 }}
        >
          Try Again
        </button>
        <Link to="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Go to Home
        </Link>
      </div>
    );
  }

  const bill = billData.bill || {};
  const currency = bill.currency || billData.currency || 'USD';
  const restaurantName = bill.restaurantName || billData.restaurantName || '';
  const totals = bill.totals || {};
  const peopleTotals = totals.people || bill.people || [];
  const items = bill.items || [];
  const taxMinor = bill.taxMinor ?? 0;
  const taxInclusive = Boolean(bill.taxInclusive);
  const tipMinor = bill.tipMinor ?? 0;
  const additionalCharges = bill.additionalCharges || [];
  const billTotalMinor = totals.billTotalMinor ?? 0;
  const itemsTotalMinor = totals.itemsTotalMinor ?? items.reduce((sum, i) => sum + (i.priceMinor || 0), 0);

  // Map person ID to name for fast lookup
  const peopleMap = new Map((bill.people || []).map((p) => [p.id, p.name]));

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'inline-block',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            backgroundColor: '#eff6ff',
            color: 'var(--primary-color)',
            padding: '3px 8px',
            borderRadius: '12px',
            marginBottom: 8,
          }}
        >
          Finalized Bill
        </div>
        <h1 className="title" style={{ marginBottom: 4 }}>
          {restaurantName || 'Receipt Split'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
          {peopleTotals.length} participant{peopleTotals.length !== 1 ? 's' : ''} · {currency}
        </p>
      </div>

      {/* Prominent Bill Total Banner */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid var(--border-color)',
          borderRadius: '14px',
          padding: '16px 18px',
          marginBottom: 20,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          Total
        </span>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)', flexShrink: 0 }}>
          {formatAmount(billTotalMinor, currency)}
        </span>
      </div>

      {/* People Totals Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <h2
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Participant Totals
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {peopleTotals.map((person) => (
            <div
              key={person.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '1rem',
                  color: 'var(--text-main)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {person.name}
              </span>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', flexShrink: 0 }}>
                {formatAmount(person.totalMinor, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Items List Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <h2
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Items ({items.length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item, index) => {
            const assignees = (item.assignedTo || [])
              .map((id) => peopleMap.get(id) || id);

            return (
              <div
                key={item.id || index}
                style={{
                  borderBottom: index < items.length - 1 ? '1px solid #f1f5f9' : 'none',
                  paddingBottom: index < items.length - 1 ? 12 : 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 4,
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      flex: 1,
                      minWidth: 0,
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.quantity && item.quantity > 1 && (
                      <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>
                        {item.quantity} ×
                      </span>
                    )}
                    <span>{item.name}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: item.priceMinor < 0 ? '#16a34a' : 'var(--text-main)',
                      flexShrink: 0,
                    }}
                  >
                    {formatAmount(item.priceMinor ?? 0, currency)}
                  </div>
                </div>

                {/* Assigned People */}
                <div
                  style={{
                    fontSize: '0.825rem',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    wordBreak: 'break-word',
                  }}
                >
                  {assignees.length > 0 ? assignees.join(' · ') : 'Unassigned'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bill Charges & Breakdown Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <h2
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Bill Summary
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: 'var(--text-muted)', gap: 8 }}>
            <span>Items Subtotal</span>
            <span style={{ fontWeight: 600, color: 'var(--text-main)', flexShrink: 0 }}>
              {formatAmount(itemsTotalMinor, currency)}
            </span>
          </div>

          {/* Tax */}
          {(taxMinor > 0 || taxInclusive) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                Tax
                {taxInclusive && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#f1f5f9',
                      color: 'var(--text-muted)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    included in items
                  </span>
                )}
              </span>
              <span style={{ fontWeight: 600, color: taxInclusive ? 'var(--text-muted)' : 'var(--text-main)', flexShrink: 0 }}>
                {taxInclusive ? `(${formatAmount(taxMinor, currency)})` : formatAmount(taxMinor, currency)}
              </span>
            </div>
          )}

          {/* Tip */}
          {tipMinor > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: 'var(--text-muted)', gap: 8 }}>
              <span>Tip</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', flexShrink: 0 }}>
                {formatAmount(tipMinor, currency)}
              </span>
            </div>
          )}

          {/* Additional Charges */}
          {additionalCharges.map((charge, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: 'var(--text-muted)', gap: 8 }}>
              <span style={{ wordBreak: 'break-word', minWidth: 0, flex: 1 }}>{charge.name}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', flexShrink: 0 }}>
                {formatAmount(charge.amountMinor, currency)}
              </span>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '6px 0' }} />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontWeight: 800,
              fontSize: '1.05rem',
              color: 'var(--text-main)',
              gap: 8,
            }}
          >
            <span>Total</span>
            <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>
              {formatAmount(billTotalMinor, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Start New Split Action */}
      <Link
        to="/scan"
        className="btn-secondary"
        style={{ alignSelf: 'center', textDecoration: 'none', textAlign: 'center', marginBottom: 16 }}
      >
        Scan a New Receipt
      </Link>
    </div>
  );
}

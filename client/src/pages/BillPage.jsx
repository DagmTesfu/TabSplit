import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBill } from '../api';
import { getAvatarColor, getInitials } from '../avatarColors';

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
  const [expandedPersonId, setExpandedPersonId] = useState(null);

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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div className="spinner spinner-lg" />
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

      {/* People Totals List (Interactive Tap-to-Expand Breakdown) */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          marginBottom: 20,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2
            style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            People & Totals
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tap name to view breakdown</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {peopleTotals.map((person) => {
            const isExpanded = expandedPersonId === person.id;
            const avatar = getAvatarColor(person.id || person.name);

            // Filter items assigned to this specific person from the server bill
            const personItems = items.filter((item) => {
              const assigned = Array.isArray(item.assignedTo) ? item.assignedTo : [];
              return assigned.includes(person.id);
            });

            return (
              <div
                key={person.id}
                style={{
                  border: isExpanded ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isExpanded ? 'var(--color-surface-subtle)' : '#ffffff',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Person Header (Tap to toggle) */}
                <button
                  type="button"
                  onClick={() => setExpandedPersonId(isExpanded ? null : person.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    padding: '12px 14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: avatar.bg,
                        color: avatar.color,
                        border: `1px solid ${avatar.border}`,
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(person.name)}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: 'var(--color-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {person.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                      {formatAmount(person.totalMinor, currency)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {/* Expanded Breakdown Details */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderTop: '1px solid var(--color-border)',
                      backgroundColor: '#ffffff',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Assigned Dishes
                    </div>

                    {personItems.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {personItems.map((item, idx) => {
                          const splitCount = (item.assignedTo || []).length;
                          return (
                            <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text)' }}>
                              <span>
                                {item.name}
                                {splitCount > 1 && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 6 }}>
                                    (1/{splitCount} share)
                                  </span>
                                )}
                              </span>
                              <span style={{ fontWeight: 600 }}>
                                {splitCount > 1
                                  ? formatAmount(Math.round((item.priceMinor || 0) / splitCount), currency)
                                  : formatAmount(item.priceMinor || 0, currency)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No solo dishes assigned</div>
                    )}

                    {/* Server-calculated Adjustment (Tax, Tip & Charges) */}
                    {person.adjustmentMinor !== undefined && person.adjustmentMinor > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: 'var(--color-text-muted)',
                          paddingTop: 6,
                          borderTop: '1px dashed var(--color-border)',
                        }}
                      >
                        <span>Share of tax, tip & charges</span>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {formatAmount(person.adjustmentMinor, currency)}
                        </span>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 800,
                        paddingTop: 6,
                        borderTop: '1px solid var(--color-border)',
                        fontSize: '0.95rem',
                      }}
                    >
                      <span>{person.name}'s Total</span>
                      <span style={{ color: 'var(--color-primary)' }}>{formatAmount(person.totalMinor, currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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

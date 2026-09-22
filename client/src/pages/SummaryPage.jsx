import React, { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { calculateAssignments } from '../calculateAssignments';
import { finalizeBill, buildFinalizePayload } from '../api';
import { getSessionData, clearSessionData } from '../session';
import SwipeToConfirm from '../components/SwipeToConfirm';

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

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSessionData();
  const receipt = location.state?.receipt || session.receipt;
  const people = Array.isArray(location.state?.people) && location.state.people.length > 0
    ? location.state.people
    : (Array.isArray(session.people) && session.people.length > 0 ? session.people : []);
  const assignments = location.state?.assignments && typeof location.state.assignments === 'object' && Object.keys(location.state.assignments).length > 0
    ? location.state.assignments
    : (session.assignments || {});

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const { calculation, error } = useMemo(() => {
    if (!receipt || !Array.isArray(people) || people.length === 0 || !assignments) {
      return { calculation: null, error: null };
    }
    try {
      const calc = calculateAssignments({ receipt, people, assignments });
      return { calculation: calc, error: null };
    } catch (err) {
      return { calculation: null, error: err.message || 'Calculation error occurred' };
    }
  }, [receipt, people, assignments]);

  if (!receipt || !Array.isArray(people) || people.length === 0 || !assignments) {
    return (
      <div className="page page-center">
        <h1 className="title">No Bill Found</h1>
        <p className="subtitle">
          Please assign items before viewing the summary.
        </p>
        <Link to="/scan" className="btn-primary">
          Go to Scanner
        </Link>
      </div>
    );
  }

  const currency = receipt.currency ?? 'USD';

  if (error) {
    return (
      <div className="page">
        <div style={{ marginBottom: 20 }}>
          <h1 className="title" style={{ marginBottom: 4 }}>
            Bill Summary
          </h1>
        </div>

        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: 20,
            color: '#991b1b',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Calculation Error</div>
          <div style={{ fontSize: '0.9rem' }}>{error}</div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/assign', { state: { receipt, people, assignments } })}
          className="btn-secondary"
          style={{ alignSelf: 'center' }}
        >
          ← Back to Assign
        </button>
      </div>
    );
  }

  const {
    peopleTotals,
    itemsTotalMinor,
    taxMinor,
    taxInclusive,
    tipMinor,
    additionalCharges,
    billTotalMinor,
    unassignedItemIds,
    fullyAssigned,
  } = calculation;

  const unassignedCount = unassignedItemIds.length;

  const handleFinalize = async () => {
    if (isFinalizing || !fullyAssigned) return;
    setIsFinalizing(true);
    setSubmitError(null);

    try {
      const payload = buildFinalizePayload({ receipt, people, assignments });
      const response = await finalizeBill(payload);
      clearSessionData();
      navigate('/finalized', {
        state: {
          shareCode: response.shareCode,
          shareUrl: response.shareUrl,
          bill: response.bill,
        },
      });
    } catch (err) {
      setIsFinalizing(false);
      setSubmitError(err.message || 'Failed to finalize bill. Please try again.');
    }
  };

  return (
    <div className="page">
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="title" style={{ marginBottom: 4 }}>
          Bill Summary
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
          {receipt.restaurantName ? `${receipt.restaurantName} · ` : ''}
          {people.length} participant{people.length !== 1 ? 's' : ''} · {currency}
        </p>
      </div>

      {/* Unassigned Warning Banner */}
      {!fullyAssigned && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, color: '#92400e', fontSize: '0.95rem' }}>
                {unassignedCount === 1
                  ? '1 item still needs to be assigned.'
                  : `${unassignedCount} items still need to be assigned.`}
              </div>
              <div style={{ color: '#b45309', fontSize: '0.85rem' }}>
                Unassigned items are not allocated to any participant.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/assign', { state: { receipt, people, assignments } })}
            style={{
              padding: '8px 14px',
              minHeight: '38px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: '#f59e0b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              touchAction: 'manipulation',
            }}
          >
            Assign Items
          </button>
        </div>
      )}

      {/* Finalize Error Banner */}
      {submitError && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: 20,
            color: '#991b1b',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
              Finalization Failed
            </div>
            <div style={{ fontSize: '0.875rem' }}>{submitError}</div>
          </div>
        </div>
      )}

      {/* Bill Breakdown Card */}
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
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Bill Breakdown
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.95rem' }}>
          {/* Items Subtotal */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: 'var(--text-main)', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>Items Subtotal</span>
            <span style={{ fontWeight: 600, flexShrink: 0 }}>{formatAmount(itemsTotalMinor, currency)}</span>
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
                    Included in items
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Tip</span>
              <span style={{ fontWeight: 600, flexShrink: 0 }}>{formatAmount(tipMinor, currency)}</span>
            </div>
          )}

          {/* Additional Charges */}
          {additionalCharges.map((charge, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', wordBreak: 'break-word', minWidth: 0, flex: 1 }}>{charge.name}</span>
              <span style={{ fontWeight: 600, flexShrink: 0 }}>{formatAmount(charge.amountMinor, currency)}</span>
            </div>
          ))}

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border-color)', margin: '6px 0' }} />

          {/* Total */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              gap: 8,
            }}
          >
            <span>Total</span>
            <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>{formatAmount(billTotalMinor, currency)}</span>
          </div>
        </div>
      </div>

      {/* Participant Breakdown Section */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Participants ({peopleTotals.length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {peopleTotals.map((person) => (
            <div
              key={person.id}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Person Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  {person.name}
                </div>
                <div
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: 'var(--primary-color)',
                    flexShrink: 0,
                  }}
                >
                  {formatAmount(person.totalMinor, currency)}
                </div>
              </div>

              {/* Subtotal & Adjustment Details */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: '0.875rem',
                  backgroundColor: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: 'var(--text-muted)', gap: 8 }}>
                  <span>Items</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', flexShrink: 0 }}>
                    {formatAmount(person.itemsSubtotalMinor, currency)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: 'var(--text-muted)', gap: 8 }}>
                  <span>Tax, tip & charges</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', flexShrink: 0 }}>
                    {formatAmount(person.adjustmentMinor, currency)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    borderTop: '1px dashed var(--border-color)',
                    paddingTop: 6,
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    gap: 8,
                  }}
                >
                  <span>Total</span>
                  <span style={{ flexShrink: 0 }}>{formatAmount(person.totalMinor, currency)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {fullyAssigned && (
          <SwipeToConfirm
            onConfirm={handleFinalize}
            disabled={isFinalizing}
            label={isFinalizing ? 'Finalizing...' : 'Swipe to Finalize Bill ➔'}
          />
        )}

        <button
          type="button"
          onClick={() => navigate('/assign', { state: { receipt, people, assignments } })}
          disabled={isFinalizing}
          className="btn-secondary"
          style={{
            alignSelf: 'center',
            opacity: isFinalizing ? 0.6 : 1,
            cursor: isFinalizing ? 'not-allowed' : 'pointer',
          }}
        >
          ← Back to Assign
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBill } from '../api';
import { getAvatarColor, getInitials } from '../avatarColors';
import {
  getMyName,
  setMyName,
  saveBillToHistory,
  getHostPaymentAccounts,
  getPaidStatus,
  setPersonPaidStatus,
} from '../storage';
import { decodePaymentHash } from '../paymentAccounts';
import PaymentMethods from '../components/PaymentMethods';

function currencySymbol(currency) {
  if (currency === 'USD') return '$';
  if (currency === 'EUR') return '€';
  if (currency === 'GBP') return '£';
  if (currency === 'CAD') return 'CA$';
  if (currency === 'AUD') return 'A$';
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
  const [myName, setMyNameState] = useState(() => getMyName());
  const [showNameSelector, setShowNameSelector] = useState(false);
  const [showMathExplainer, setShowMathExplainer] = useState(false);
  const [paidMap, setPaidMap] = useState(() => (shareCode ? getPaidStatus(shareCode) : {}));
  const [paymentAccounts, setPaymentAccounts] = useState(() => {
    if (typeof window !== 'undefined') {
      const fromUrl = decodePaymentHash(window.location.hash) || decodePaymentHash(window.location.search);
      if (fromUrl && (fromUrl.telebirr || fromUrl.cbe || fromUrl.awash || fromUrl.abyssinia || fromUrl.accountName)) {
        return fromUrl;
      }
    }
    return getHostPaymentAccounts();
  });

  useEffect(() => {
    if (shareCode) {
      setPaidMap(getPaidStatus(shareCode));
    }
  }, [shareCode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fromUrl = decodePaymentHash(window.location.hash) || decodePaymentHash(window.location.search);
      if (fromUrl && (fromUrl.telebirr || fromUrl.cbe || fromUrl.awash || fromUrl.abyssinia || fromUrl.accountName)) {
        setPaymentAccounts(fromUrl);
      }
    }
  }, []);

  const fetchBill = useCallback(async () => {
    if (!shareCode) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBill(shareCode);
      setBillData(data);
      if (data) {
        const b = data.bill || {};
        const bTotals = b.totals || {};
        const pList = bTotals.people || b.people || [];
        saveBillToHistory({
          shareCode,
          restaurantName: b.restaurantName || data.restaurantName,
          currency: b.currency || data.currency || 'USD',
          totalMinor: bTotals.billTotalMinor ?? 0,
          participantCount: pList.length,
          createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
          role: 'viewed',
        });
      }
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

  // Personalization: check if user matches a person on this bill
  const myPerson = myName
    ? peopleTotals.find((p) => (p.name || '').trim().toLowerCase() === myName.trim().toLowerCase())
    : null;

  const handleSelectMe = (name) => {
    setMyName(name);
    setMyNameState(name);
    setShowNameSelector(false);
  };

  const handleClearMe = () => {
    setMyName('');
    setMyNameState('');
    setShowNameSelector(true);
  };

  const handleTogglePaid = (personId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const nextVal = !paidMap[personId];
    setPersonPaidStatus(shareCode, personId, nextVal);
    setPaidMap((prev) => ({ ...prev, [personId]: nextVal }));
  };

  const handlePersonWhatsAppShare = (person) => {
    const restName = restaurantName ? `for ${restaurantName}` : '';
    const shareUrl = window.location.href;
    const text = `Hey ${person.name}! 👋 Your share ${restName} is ${formatAmount(person.totalMinor ?? 0, currency)}.\n\nView details & pay back here:\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const paidCount = peopleTotals.filter((p) => paidMap[p.id]).length;

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

      {/* Personalized Share Card (Remember My Name) */}
      {myPerson && !showNameSelector ? (
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #86efac',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
            marginBottom: 20,
            boxShadow: '0 2px 8px rgba(22, 101, 52, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#166534',
                backgroundColor: '#dcfce7',
                padding: '3px 8px',
                borderRadius: '12px',
              }}
            >
              👤 Your Share
            </span>
            <button
              type="button"
              onClick={handleClearMe}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Not {myPerson.name}?
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                Hey {myPerson.name} 👋
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                Here is your exact calculated total to pay:
              </p>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-primary)' }}>
              {formatAmount(myPerson.totalMinor, currency)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpandedPersonId(expandedPersonId === myPerson.id ? null : myPerson.id)}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #bbf7d0',
              borderRadius: 'var(--radius-sm)',
              color: '#166534',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{expandedPersonId === myPerson.id ? '▲ Hide' : '▼ View'} your dish breakdown</span>
          </button>

          {/* Quick Mark-as-Paid Toggle for User */}
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              backgroundColor: paidMap[myPerson.id] ? '#dcfce7' : '#ffffff',
              border: `1.5px solid ${paidMap[myPerson.id] ? '#86efac' : '#bbf7d0'}`,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.9rem' }}>{paidMap[myPerson.id] ? '✅' : '⏳'}</span>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: paidMap[myPerson.id] ? '#166534' : 'var(--color-text)',
                }}
              >
                {paidMap[myPerson.id] ? "You've marked your share as paid!" : 'Have you paid your share?'}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => handleTogglePaid(myPerson.id, e)}
              style={{
                backgroundColor: paidMap[myPerson.id] ? '#166534' : 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                transition: 'all 0.15s ease',
              }}
            >
              {paidMap[myPerson.id] ? '✓ Paid (Undo)' : 'I Already Paid'}
            </button>
          </div>
        </div>
      ) : (
        peopleTotals.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
              👋 Which one is you? Tap your name to see your share:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {peopleTotals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectMe(p.name)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: '#ffffff',
                    color: 'var(--color-text)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* Host Payment Methods (Telebirr, CBE, Awash, Abyssinia) */}
      <PaymentMethods
        accounts={paymentAccounts}
        onAccountsChange={setPaymentAccounts}
        restaurantName={restaurantName}
      />

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

        {/* Settlement Progress Tracker */}
        {peopleTotals.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 12px',
              backgroundColor: 'var(--color-surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: 5 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Settlement Progress</span>
              <span style={{ color: paidCount === peopleTotals.length ? '#16a34a' : 'var(--color-primary)' }}>
                {paidCount} of {peopleTotals.length} paid ({Math.round((paidCount / peopleTotals.length) * 100)}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(paidCount / peopleTotals.length) * 100}%`,
                  height: '100%',
                  backgroundColor: paidCount === peopleTotals.length ? '#16a34a' : 'var(--color-primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

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
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{person.name}</span>
                      {myPerson && person.id === myPerson.id && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          You
                        </span>
                      )}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePersonWhatsAppShare(person);
                      }}
                      title={`Share via WhatsApp to ${person.name}`}
                      style={{
                        background: '#25D366',
                        border: 'none',
                        color: '#ffffff',
                        padding: '4px 7px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <span>💬</span>
                      <span>Share</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleTogglePaid(person.id, e)}
                      title="Toggle paid status"
                      style={{
                        background: paidMap[person.id] ? '#dcfce7' : '#f8fafc',
                        border: `1.5px solid ${paidMap[person.id] ? '#86efac' : '#cbd5e1'}`,
                        color: paidMap[person.id] ? '#166534' : '#64748b',
                        padding: '4px 7px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span>{paidMap[person.id] ? '✓ Paid' : 'Unpaid'}</span>
                    </button>

                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-primary)', marginLeft: 2 }}>
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

      {/* Rounding & Calculation Fairness Explainer */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          marginBottom: 16,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <button
          type="button"
          onClick={() => setShowMathExplainer((prev) => !prev)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚖️</span> How is this bill calculated?
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {showMathExplainer ? '▲' : '▼'}
          </span>
        </button>

        {showMathExplainer && (
          <div
            style={{
              marginTop: 10,
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
              borderTop: '1px dashed var(--color-border)',
              paddingTop: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div>
              <strong style={{ color: 'var(--color-text)' }}>Exact Cent Math:</strong> When dishes or taxes don't divide into exact whole numbers (e.g. 100 split 3 ways is 33.333...), TabSplit uses largest-remainder rounding so every person's share sums up to the receipt total down to the exact minor unit (no missing or duplicate cents).
            </div>
            <div>
              <strong style={{ color: 'var(--color-text)' }}>Fair Tax & Tip:</strong> Taxes, tips, and service charges are weighted by what each person ordered, so you only pay taxes proportional to your own dishes.
            </div>
          </div>
        )}
      </div>

      {/* Growth Loop: Split your next bill banner */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-subtle)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 4 }}>
          Splitting lunch or coffee next? ☕
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Snap a receipt or enter items manually. Free, instant, no signup required.
        </p>
        <Link
          to="/"
          className="btn-primary"
          style={{
            display: 'inline-flex',
            textDecoration: 'none',
            width: '100%',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '10px 16px',
          }}
        >
          Split your next bill with TabSplit →
        </Link>
      </div>
    </div>
  );
}

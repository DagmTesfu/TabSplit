import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBill, updatePaidStatus } from '../api';
import { getAvatarColor, getInitials } from '../avatarColors';
import {
  getMyName,
  setMyName,
  saveBillToHistory,
  getHostPaymentAccounts,
  getPaidStatus,
  setPersonPaidStatus,
  mergePaidStatus,
  isBillHost,
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
  const [activeDetailTab, setActiveDetailTab] = useState('people');
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

        // Sync payment status from server
        const serverPaid = data.paidMap || b.paidMap;
        if (serverPaid && typeof serverPaid === 'object') {
          const merged = mergePaidStatus(shareCode, serverPaid);
          setPaidMap((prev) => ({ ...prev, ...merged }));
        }
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

  const handleTogglePaid = async (personId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const nextVal = !paidMap[personId];
    setPersonPaidStatus(shareCode, personId, nextVal);
    setPaidMap((prev) => ({ ...prev, [personId]: nextVal }));

    try {
      const res = await updatePaidStatus(shareCode, personId, nextVal);
      if (res?.paidMap) {
        mergePaidStatus(shareCode, res.paidMap);
        setPaidMap((prev) => ({ ...prev, ...res.paidMap }));
      }
    } catch (err) {
      console.warn('Could not sync paid status to server:', err?.message || err);
    }
  };

  const handlePersonWhatsAppShare = (person) => {
    const restName = restaurantName ? `for ${restaurantName}` : '';
    const shareUrl = window.location.href;
    const text = `Hey ${person.name}! 👋 Your share ${restName} is ${formatAmount(person.totalMinor ?? 0, currency)}.\n\nView details & pay back here:\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const isHost = isBillHost(shareCode);
  const paidCount = peopleTotals.filter((p) => paidMap[p.id]).length;

  return (
    <div className="page" style={{ maxWidth: 580, margin: '0 auto', padding: '16px 12px 32px' }}>
      {/* 1. Header: Restaurant + Total in one clean card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderRadius: 14,
          padding: '14px 18px',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0, flex: 1, marginRight: 12 }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--primary-color)',
              marginBottom: 2,
            }}
          >
            Finalized Bill
          </div>
          <h1
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              margin: 0,
              color: 'var(--text-main, #0f172a)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {restaurantName || 'Receipt Split'}
          </h1>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
            {peopleTotals.length} participant{peopleTotals.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
            Total Bill
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-color)' }}>
            {formatAmount(billTotalMinor, currency)}
          </div>
        </div>
      </div>

      {/* 2. Personalized Share Card / Hero */}
      {myPerson && !showNameSelector ? (
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #86efac',
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 14,
            boxShadow: '0 2px 8px rgba(22, 101, 52, 0.06)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#166534',
                backgroundColor: '#dcfce7',
                padding: '2px 8px',
                borderRadius: '10px',
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
                color: 'var(--color-text-muted, #64748b)',
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
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#14532d' }}>
                Hey {myPerson.name} 👋
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#166534' }}>
                Here is your share to pay:
              </p>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#15803d' }}>
              {formatAmount(myPerson.totalMinor, currency)}
            </div>
          </div>

          {/* Quick toggle to view dish breakdown */}
          <button
            type="button"
            onClick={() => setExpandedPersonId(expandedPersonId === myPerson.id ? null : myPerson.id)}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '7px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              color: '#166534',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{expandedPersonId === myPerson.id ? '▲ Hide dish breakdown' : '▼ View dish breakdown'}</span>
          </button>

          {/* Expanded dish breakdown for myPerson */}
          {expandedPersonId === myPerson.id && (
            <div
              style={{
                marginTop: 8,
                padding: '10px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {items
                .filter((item) => (item.assignedTo || []).includes(myPerson.id))
                .map((item, idx) => {
                  const splitCount = (item.assignedTo || []).length;
                  return (
                    <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-main)' }}>
                        {item.name}
                        {splitCount > 1 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                            (1/{splitCount})
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
              {myPerson.adjustmentMinor > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px dashed #e2e8f0',
                    paddingTop: 4,
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Tax, tip & charges</span>
                  <span style={{ fontWeight: 600 }}>
                    {formatAmount(myPerson.adjustmentMinor, currency)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Mark-as-Paid Toggle (Syncs across devices so host sees updates) */}
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              backgroundColor: paidMap[myPerson.id] ? '#dcfce7' : '#ffffff',
              border: `1.5px solid ${paidMap[myPerson.id] ? '#86efac' : '#bbf7d0'}`,
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{paidMap[myPerson.id] ? '✅' : (isHost ? '⏳' : '💸')}</span>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: paidMap[myPerson.id] ? '#166534' : 'var(--color-text)',
                }}
              >
                {paidMap[myPerson.id]
                  ? (isHost ? 'Marked as paid' : "You've marked your share as paid!")
                  : (isHost ? 'Have you paid your share?' : 'Sent your payment to the host?')}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => handleTogglePaid(myPerson.id, e)}
              style={{
                backgroundColor: paidMap[myPerson.id] ? '#166534' : 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {paidMap[myPerson.id] ? 'Undo' : 'I Paid'}
            </button>
          </div>
        </div>
      ) : (
        peopleTotals.length > 0 && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
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
                    borderRadius: 16,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: 'var(--color-text)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{p.name}</span>
                  <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>
                    {formatAmount(p.totalMinor, currency)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* 3. Payment Methods (Directly shows how to pay the host) */}
      <PaymentMethods
        accounts={paymentAccounts}
        onAccountsChange={setPaymentAccounts}
        isHost={isHost}
        restaurantName={restaurantName}
      />

      {/* 4. Tabbed Details: Everyone's Share vs Full Receipt */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 14,
          padding: '16px',
          marginBottom: 14,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Segmented Control Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#f1f5f9',
            borderRadius: 10,
            padding: 3,
            marginBottom: 14,
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveDetailTab('people')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: activeDetailTab === 'people' ? '#ffffff' : 'transparent',
              boxShadow: activeDetailTab === 'people' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              color: activeDetailTab === 'people' ? 'var(--primary-color)' : 'var(--text-muted, #64748b)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            👥 Everyone's Share ({peopleTotals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveDetailTab('receipt')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: activeDetailTab === 'receipt' ? '#ffffff' : 'transparent',
              boxShadow: activeDetailTab === 'receipt' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              color: activeDetailTab === 'receipt' ? 'var(--primary-color)' : 'var(--text-muted, #64748b)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🧾 Full Receipt ({items.length})
          </button>
        </div>

        {/* Tab 1: Everyone's Share */}
        {activeDetailTab === 'people' && (
          <div>
            {/* Settlement Progress Tracker (Host only) */}
            {isHost && peopleTotals.length > 0 && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Settlement Progress</span>
                  <span style={{ color: paidCount === peopleTotals.length ? '#16a34a' : 'var(--primary-color)' }}>
                    {paidCount} of {peopleTotals.length} paid ({Math.round((paidCount / peopleTotals.length) * 100)}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(paidCount / peopleTotals.length) * 100}%`,
                      height: '100%',
                      backgroundColor: paidCount === peopleTotals.length ? '#16a34a' : 'var(--primary-color)',
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
                const personItems = items.filter((item) => {
                  const assigned = Array.isArray(item.assignedTo) ? item.assignedTo : [];
                  return assigned.includes(person.id);
                });

                return (
                  <div
                    key={person.id}
                    style={{
                      border: isExpanded ? '1.5px solid var(--primary-color)' : '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: 10,
                      backgroundColor: isExpanded ? '#f8fafc' : '#ffffff',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedPersonId(isExpanded ? null : person.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        padding: '10px 12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: avatar.bg,
                            color: avatar.color,
                            border: `1px solid ${avatar.border}`,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(person.name)}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            color: 'var(--text-main, #0f172a)',
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
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                backgroundColor: '#dcfce7',
                                color: '#166534',
                                padding: '1px 5px',
                                borderRadius: '8px',
                                textTransform: 'uppercase',
                              }}
                            >
                              You
                            </span>
                          )}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {isHost && (
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
                              padding: '3px 6px',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <span>💬</span>
                            <span>Share</span>
                          </button>
                        )}

                        {isHost && (
                          <button
                            type="button"
                            onClick={(e) => handleTogglePaid(person.id, e)}
                            title="Toggle paid status"
                            style={{
                              background: paidMap[person.id] ? '#dcfce7' : '#f8fafc',
                              border: `1.5px solid ${paidMap[person.id] ? '#86efac' : '#cbd5e1'}`,
                              color: paidMap[person.id] ? '#166534' : '#64748b',
                              padding: '3px 6px',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <span>{paidMap[person.id] ? '✓ Paid' : 'Unpaid'}</span>
                          </button>
                        )}

                        <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--primary-color)', marginLeft: 2 }}>
                          {formatAmount(person.totalMinor, currency)}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div
                        style={{
                          padding: '10px 12px',
                          borderTop: '1px solid var(--border-color, #e2e8f0)',
                          backgroundColor: '#ffffff',
                          fontSize: '0.82rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Assigned Dishes
                        </div>

                        {personItems.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {personItems.map((item, idx) => {
                              const splitCount = (item.assignedTo || []).length;
                              return (
                                <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)' }}>
                                  <span>
                                    {item.name}
                                    {splitCount > 1 && (
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 4 }}>
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
                          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No solo dishes assigned</div>
                        )}

                        {person.adjustmentMinor !== undefined && person.adjustmentMinor > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              color: 'var(--text-muted)',
                              paddingTop: 4,
                              borderTop: '1px dashed #e2e8f0',
                            }}
                          >
                            <span>Share of tax, tip & charges</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {formatAmount(person.adjustmentMinor, currency)}
                            </span>
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 800,
                            paddingTop: 4,
                            borderTop: '1px solid #e2e8f0',
                            fontSize: '0.9rem',
                          }}
                        >
                          <span>{person.name}'s Total</span>
                          <span style={{ color: 'var(--primary-color)' }}>{formatAmount(person.totalMinor, currency)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Full Receipt (Items + Bill Summary + Explainer) */}
        {activeDetailTab === 'receipt' && (
          <div>
            {/* Itemized list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {items.map((item, index) => {
                const assignees = (item.assignedTo || []).map((id) => peopleMap.get(id) || id);

                return (
                  <div
                    key={item.id || index}
                    style={{
                      borderBottom: index < items.length - 1 ? '1px solid #f1f5f9' : 'none',
                      paddingBottom: index < items.length - 1 ? 8 : 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.9rem',
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
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: item.priceMinor < 0 ? '#16a34a' : 'var(--text-main)',
                          flexShrink: 0,
                        }}
                      >
                        {formatAmount(item.priceMinor ?? 0, currency)}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        marginTop: 2,
                      }}
                    >
                      {assignees.length > 0 ? assignees.join(' · ') : 'Unassigned'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bill Summary totals */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: 10,
                padding: '12px 14px',
                border: '1px solid #e2e8f0',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {formatAmount(itemsTotalMinor, currency)}
                </span>
              </div>

              {(taxMinor > 0 || taxInclusive) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Tax {taxInclusive ? '(included in items)' : ''}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {taxInclusive ? `(${formatAmount(taxMinor, currency)})` : formatAmount(taxMinor, currency)}
                  </span>
                </div>
              )}

              {tipMinor > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Tip</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {formatAmount(tipMinor, currency)}
                  </span>
                </div>
              )}

              {additionalCharges.map((charge, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>{charge.name}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {formatAmount(charge.amountMinor, currency)}
                  </span>
                </div>
              ))}

              <div style={{ borderTop: '1px solid #e2e8f0', margin: '2px 0' }} />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 800,
                  fontSize: '0.98rem',
                  color: 'var(--text-main)',
                }}
              >
                <span>Total</span>
                <span style={{ color: 'var(--primary-color)' }}>
                  {formatAmount(billTotalMinor, currency)}
                </span>
              </div>
            </div>

            {/* Collapsible Math Explainer */}
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setShowMathExplainer((prev) => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 0,
                }}
              >
                <span>⚖️ {showMathExplainer ? 'Hide calculation details' : 'How is this bill calculated?'}</span>
              </button>
              {showMathExplainer && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.5,
                    backgroundColor: '#f8fafc',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <p style={{ margin: '0 0 4px' }}>
                    <strong>Exact Minor Rounding:</strong> TabSplit splits remainder cents proportionally using largest-remainder math, ensuring no missing cents.
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Proportional Tax/Tip:</strong> Charges are divided based on what each person ordered, so you only pay taxes for your own items.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Minimal, Clean 1-Line Footer */}
      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <Link
          to="/"
          style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted, #64748b)',
            textDecoration: 'none',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Split your own bill free with</span>
          <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>TabSplit →</span>
        </Link>
      </div>
    </div>
  );
}

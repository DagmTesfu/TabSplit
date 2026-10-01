import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { saveBillToHistory, getHostPaymentAccounts } from '../storage';
import { encodePaymentHash } from '../paymentAccounts';
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

export default function FinalizedPage() {
  const location = useLocation();
  const shareCode = location.state?.shareCode;
  const shareUrl = location.state?.shareUrl;
  const bill = location.state?.bill;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (shareCode && bill) {
      const totals = bill.totals || {};
      const peopleTotals = totals.people || bill.people || [];
      const billTotalMinor = totals.billTotalMinor ?? bill.totalMinor ?? 0;
      saveBillToHistory({
        shareCode,
        restaurantName: bill.restaurantName,
        currency: bill.currency || 'USD',
        totalMinor: billTotalMinor,
        participantCount: peopleTotals.length,
        createdAt: Date.now(),
        role: 'created',
      });
    }
  }, [shareCode, bill]);

  if (!shareCode && !bill) {
    return (
      <div className="page page-center">
        <h1 className="title">No Finalized Bill</h1>
        <p className="subtitle">
          Please finalize a bill from the summary step.
        </p>
        <Link to="/scan" className="btn-primary">
          Go to Scanner
        </Link>
      </div>
    );
  }

  const [paymentAccounts, setPaymentAccounts] = useState(() => getHostPaymentAccounts());
  const paymentHash = encodePaymentHash(paymentAccounts);
  const effectiveShareUrl = shareUrl
    ? (paymentHash ? `${shareUrl}#pay=${paymentHash}` : shareUrl)
    : '';

  const handleCopy = async (textToCopy = effectiveShareUrl) => {
    if (!textToCopy) return;

    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        success = true;
      } catch {
        success = false;
      }
    }

    if (!success) {
      // Fallback for HTTP / non-secure mobile testing contexts
      try {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    if (!effectiveShareUrl) return;
    const restName = bill?.restaurantName ? `for ${bill.restaurantName}` : '';
    const text = `🍽️ TabSplit Bill Split ${restName}:\nTotal: ${formatAmount(billTotalMinor, currency)}\n\nView your share & payment details here:\n${effectiveShareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePersonWhatsAppShare = (person) => {
    if (!effectiveShareUrl) return;
    const restName = bill?.restaurantName ? `for ${bill.restaurantName}` : '';
    const text = `Hey ${person.name}! 👋 Your share ${restName} is ${formatAmount(person.totalMinor ?? 0, currency)}.\n\nView details & pay back here:\n${effectiveShareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const currency = bill?.currency || 'USD';
  const totals = bill?.totals || {};
  const peopleTotals = totals.people || bill?.people || [];
  const billTotalMinor = totals.billTotalMinor ?? bill?.totalMinor ?? 0;

  return (
    <div className="page" style={{ padding: '8px 0 20px' }}>
      {/* Confirmation Receipt Cutout Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 16px',
          textAlign: 'center',
          marginBottom: 16,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Emerald Checkmark Badge */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-success-bg)',
            border: '2px solid var(--color-success)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.3rem',
            color: 'var(--color-success)',
            marginBottom: 10,
            boxShadow: '0 4px 10px rgba(15, 123, 95, 0.15)',
          }}
        >
          ✓
        </div>

        <h1 className="title" style={{ fontSize: '1.45rem', marginBottom: 2 }}>
          Split Confirmed!
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: 14 }}>
          {bill?.restaurantName || 'Receipt Split'}
        </p>

        {billTotalMinor > 0 && (
          <div
            style={{
              borderTop: '1px dashed var(--color-border)',
              borderBottom: '1px dashed var(--color-border)',
              padding: '10px 0',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-muted)',
                marginBottom: 2,
              }}
            >
              TOTAL SETTLED
            </div>
            <div
              style={{
                fontSize: '1.85rem',
                fontWeight: 900,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
              }}
            >
              {formatAmount(billTotalMinor, currency)}
            </div>
          </div>
        )}

        {/* Participant Breakdown Badges */}
        {peopleTotals.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
            {peopleTotals.map((person) => (
              <div
                key={person.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{person.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>
                    {formatAmount(person.totalMinor ?? 0, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePersonWhatsAppShare(person)}
                    title={`Send share to ${person.name} via WhatsApp`}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#25D366',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>💬</span> WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Host Payment Methods (Telebirr, CBE, Awash, Abyssinia) */}
      <PaymentMethods
        accounts={paymentAccounts}
        onAccountsChange={setPaymentAccounts}
        isHost={true}
      />

      {/* Share Link Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: 16,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}
        >
          SHARE WITH FRIENDS
        </div>

        {effectiveShareUrl && (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                readOnly
                value={effectiveShareUrl}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: '40px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-subtle)',
                  fontSize: '0.85rem',
                  color: 'var(--color-text)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => handleCopy(effectiveShareUrl)}
                style={{
                  padding: '10px 16px',
                  minHeight: '40px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: copied ? 'var(--color-success)' : 'var(--color-primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease',
                  touchAction: 'manipulation',
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              style={{
                marginTop: 10,
                width: '100%',
                minHeight: '42px',
                backgroundColor: '#25D366',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
              }}
            >
              <span>💬</span> Share Full Breakdown on WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        {shareCode && (
          <Link
            to={`/b/${shareCode}`}
            className="btn-secondary"
            style={{ textDecoration: 'none', textAlign: 'center', width: '100%', fontWeight: 700 }}
          >
            View Public Shared Bill →
          </Link>
        )}

        <Link
          to="/"
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'none',
            padding: '8px',
          }}
        >
          Done · Start New Split
        </Link>
      </div>
    </div>
  );
}

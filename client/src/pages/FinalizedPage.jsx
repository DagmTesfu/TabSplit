import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function FinalizedPage() {
  const location = useLocation();
  const shareCode = location.state?.shareCode;
  const shareUrl = location.state?.shareUrl;
  const bill = location.state?.bill;
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    if (!shareUrl) return;

    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        success = true;
      } catch {
        success = false;
      }
    }

    if (!success) {
      // Fallback for HTTP / non-secure mobile testing contexts
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
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
              {currency === 'ETB' ? 'ETB ' : '$'}
              {(billTotalMinor / 100).toFixed(2)}
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
                  padding: '7px 10px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{person.name}</span>
                <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>
                  {currency === 'ETB' ? 'ETB ' : '$'}
                  {((person.totalMinor || 0) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

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

        {shareUrl && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={shareUrl}
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
              onClick={handleCopy}
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

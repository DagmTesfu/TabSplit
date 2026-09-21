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
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback or ignore clipboard failure
      }
    }
  };

  return (
    <div className="page">
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
        <h1 className="title" style={{ marginBottom: 6 }}>
          Bill Finalized
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
          {bill?.restaurantName ? `${bill.restaurantName} · ` : ''}
          Your split is ready to share!
        </p>
      </div>

      {/* Share Details Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '18px 16px',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
            Share Code
          </div>
          <div
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: 'var(--primary-color)',
              fontFamily: 'monospace',
            }}
          >
            {shareCode}
          </div>
        </div>

        {shareUrl && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Share Link
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                readOnly
                value={shareUrl}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: '42px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.9rem',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  padding: '10px 16px',
                  minHeight: '42px',
                  borderRadius: '6px',
                  backgroundColor: copied ? '#16a34a' : 'var(--primary-color)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease',
                  touchAction: 'manipulation',
                }}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Shared Bill Info Card */}
      <div
        style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: 24,
          color: '#1e40af',
          fontSize: '0.9rem',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Shared Bill
        </div>
        <div>
          Your friends can open this link to see what they owe.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        {shareCode && (
          <Link
            to={`/b/${shareCode}`}
            className="btn-primary"
            style={{ textDecoration: 'none', textAlign: 'center', width: '100%' }}
          >
            View Shared Bill
          </Link>
        )}

        <Link
          to="/"
          className="btn-secondary"
          style={{ textDecoration: 'none', textAlign: 'center' }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

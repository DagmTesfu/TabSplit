import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="page page-center" style={{ padding: '8px 0 16px' }}>
      {/* Hero Icon */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: 'var(--color-primary-subtle)',
          border: '1px solid var(--color-primary-border)',
          fontSize: '2rem',
          margin: '0 auto 16px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        🧾
      </div>

      {/* Main Headline & Tagline */}
      <h1
        className="title"
        style={{
          fontSize: '1.85rem',
          fontWeight: 800,
          color: 'var(--color-text)',
          marginBottom: 8,
          letterSpacing: '-0.03em',
        }}
      >
        Split the bill.
        <br />
        <span style={{ color: 'var(--color-primary)' }}>Not the friendship.</span>
      </h1>

      <p
        className="subtitle"
        style={{
          maxWidth: '340px',
          margin: '0 auto 24px',
          fontSize: '0.95rem',
          color: 'var(--color-text-muted)',
          lineHeight: 1.5,
        }}
      >
        Snap a receipt, tap to assign dishes to friends, and split tax & tip fairly in seconds.
      </p>

      {/* Primary CTA */}
      <div style={{ marginBottom: 28 }}>
        <Link
          to="/scan"
          className="btn-primary"
          style={{
            maxWidth: '320px',
            margin: '0 auto',
            fontSize: '1.05rem',
            padding: '14px 24px',
            gap: 8,
          }}
        >
          <span>📸</span>
          <span>Scan a Receipt</span>
        </Link>
      </div>

      {/* Value Prop 3-Step Highlights */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          textAlign: 'left',
          backgroundColor: 'var(--color-surface-subtle)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
          maxWidth: '360px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            📸
          </div>
          <div style={{ fontSize: '0.875rem' }}>
            <strong style={{ color: 'var(--color-text)', display: 'block' }}>1. Fast AI Receipt Scanning</strong>
            <span style={{ color: 'var(--color-text-muted)' }}>Reads printed items, prices, tax & tip</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            👥
          </div>
          <div style={{ fontSize: '0.875rem' }}>
            <strong style={{ color: 'var(--color-text)', display: 'block' }}>2. Flexible Item Assignment</strong>
            <span style={{ color: 'var(--color-text-muted)' }}>Solo items & multi-person shared plates</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            🔗
          </div>
          <div style={{ fontSize: '0.875rem' }}>
            <strong style={{ color: 'var(--color-text)', display: 'block' }}>3. Instant Shareable Link</strong>
            <span style={{ color: 'var(--color-text-muted)' }}>Friends view their individual breakdown</span>
          </div>
        </div>
      </div>
    </div>
  );
}

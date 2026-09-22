import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="page page-center" style={{ padding: '8px 0 20px' }}>
      {/* Brand & Headline */}
      <div style={{ marginTop: 4, marginBottom: 16 }}>
        <h1
          className="title"
          style={{
            fontSize: '1.95rem',
            fontWeight: 900,
            color: 'var(--color-text)',
            marginBottom: 8,
            letterSpacing: '-0.035em',
            lineHeight: 1.15,
          }}
        >
          Split the bill.
          <br />
          <span style={{ color: 'var(--color-primary)' }}>Not the friendship.</span>
        </h1>

        <p
          className="subtitle"
          style={{
            maxWidth: '320px',
            margin: '0 auto',
            fontSize: '0.95rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.45,
          }}
        >
          Snap the receipt. We handle the math nobody wants to do.
        </p>
      </div>

      {/* Concept C Comparison Card: What a photo can't do */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '340px',
          width: '100%',
          margin: '0 auto 24px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
          textAlign: 'left',
        }}
      >
        {/* Card Header */}
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid var(--color-border)',
            fontSize: '0.8rem',
            fontWeight: 800,
            color: 'var(--color-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          What a photo can't do:
        </div>

        {/* Card Rows with Red Crosses */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 800, lineHeight: 1.3 }}>✕</span>
            <span style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.35 }}>
              Split the appetizer you shared 3 ways
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 800, lineHeight: 1.3 }}>✕</span>
            <span style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.35 }}>
              Calculate each person's fair share of tax & tip
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 800, lineHeight: 1.3 }}>✕</span>
            <span style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.35 }}>
              Give everyone a clear total they can just pay
            </span>
          </div>
        </div>

        {/* Card Footer: TabSplit Solution */}
        <div
          style={{
            padding: '9px 14px',
            backgroundColor: '#ecfdf5',
            borderTop: '1px solid #d1fae5',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ color: '#0f7b5f', fontSize: '0.9rem', fontWeight: 800 }}>✓</span>
          <span style={{ fontSize: '0.8rem', color: '#0f7b5f', fontWeight: 700 }}>
            TabSplit handles all of this in 30 seconds
          </span>
        </div>
      </div>

      {/* Primary CTA */}
      <div style={{ marginBottom: 10 }}>
        <Link
          to="/scan"
          className="btn-primary"
          style={{
            maxWidth: '320px',
            margin: '0 auto',
            fontSize: '1rem',
            fontWeight: 700,
            padding: '14px 24px',
            gap: 8,
            boxShadow: '0 4px 14px rgba(30, 58, 95, 0.18)',
          }}
        >
          <span>Scan your receipt →</span>
        </Link>
      </div>

      {/* Trust Subtext */}
      <p
        style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          marginBottom: 20,
        }}
      >
        Free · No account · No app to download
      </p>

      {/* Bottom Proof Line */}
      <div
        style={{
          paddingTop: 14,
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          maxWidth: '320px',
          margin: '0 auto',
          lineHeight: 1.4,
        }}
      >
        Handles solo plates, shared apps, tax & tip fairly.
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [platform, setPlatform] = useState('other'); // 'ios' | 'android' | 'desktop' | 'other'

  useEffect(() => {
    // Check if already running in standalone mode (installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    // Detect platform for tailored installation instructions
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
      setPlatform('ios');
    } else if (/Android/.test(ua)) {
      setPlatform('android');
    } else if (!/Mobi|Android/i.test(ua)) {
      setPlatform('desktop');
    }

    // Listen for beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch {
        setShowInstallGuide(true);
      }
    } else {
      setShowInstallGuide((prev) => !prev);
    }
  };

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
          margin: '0 auto 20px',
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

      {/* How It Works Section */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '340px',
          width: '100%',
          margin: '0 auto 24px',
          padding: '16px 14px',
          boxShadow: 'var(--shadow-sm)',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-text-muted)',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          How it works
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Step 01 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '8px 10px',
              backgroundColor: 'var(--color-surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 900,
                color: 'var(--color-primary)',
                letterSpacing: '0.04em',
                paddingTop: 1,
                flexShrink: 0,
              }}
            >
              01
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SNAP
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Take a photo of the receipt.
              </div>
            </div>
          </div>

          {/* Step 02 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '8px 10px',
              backgroundColor: 'var(--color-surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 900,
                color: 'var(--color-primary)',
                letterSpacing: '0.04em',
                paddingTop: 1,
                flexShrink: 0,
              }}
            >
              02
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                PICK
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Tap the people who shared each dish.
              </div>
            </div>
          </div>

          {/* Step 03 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '8px 10px',
              backgroundColor: 'var(--color-surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 900,
                color: 'var(--color-primary)',
                letterSpacing: '0.04em',
                paddingTop: 1,
                flexShrink: 0,
              }}
            >
              03
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SHARE
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Everyone sees exactly what they owe.
              </div>
            </div>
          </div>
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
          marginBottom: 12,
        }}
      >
        Free · No account · No app to download
      </p>

      {/* PWA Install Secondary Action */}
      {!isInstalled && (
        <div style={{ maxWidth: '320px', margin: '0 auto 16px', width: '100%' }}>
          <button
            type="button"
            onClick={handleInstallClick}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              touchAction: 'manipulation',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            <span>📱</span>
            <span>Install TabSplit on phone</span>
          </button>

          {/* Platform-appropriate Fallback Installation Guidance */}
          {showInstallGuide && (
            <div
              style={{
                marginTop: 8,
                padding: '10px 12px',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem',
                lineHeight: 1.45,
                color: 'var(--color-text)',
                textAlign: 'left',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--color-primary)' }}>
                {platform === 'ios'
                  ? 'How to install on iPhone & iPad:'
                  : platform === 'android'
                  ? 'How to install on Android:'
                  : 'How to install:'}
              </div>

              {platform === 'ios' ? (
                <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <li>Tap the <strong>Share</strong> button (box with upward arrow) in Safari.</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top-right corner.</li>
                </ol>
              ) : platform === 'android' ? (
                <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <li>Tap the <strong>three dots (⋮)</strong> in Chrome's top-right menu.</li>
                  <li>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                  <li>Confirm the prompt to install TabSplit.</li>
                </ol>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <li>Click the <strong>install icon (⊕)</strong> in your browser's address bar.</li>
                  <li>Or open your browser menu and select <strong>Install TabSplit</strong>.</li>
                </ol>
              )}
            </div>
          )}
        </div>
      )}

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

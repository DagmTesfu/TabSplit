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
    <div className="page" style={{ padding: '4px 0 24px' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', marginBottom: 24, marginTop: 4 }}>
        <div
          style={{
            display: 'inline-block',
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            backgroundColor: 'var(--color-primary-subtle)',
            color: 'var(--color-primary)',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            marginBottom: 12,
            border: '1px solid var(--color-primary-border)',
          }}
        >
          Bill Splitting Made Simple
        </div>

        <h1
          className="title"
          style={{
            fontSize: '1.95rem',
            fontWeight: 900,
            color: 'var(--color-text)',
            marginBottom: 10,
            letterSpacing: '-0.035em',
            lineHeight: 1.15,
          }}
        >
          Dinner was great.
          <br />
          <span style={{ color: 'var(--color-primary)' }}>Splitting it shouldn't be a whole thing.</span>
        </h1>

        <p
          className="subtitle"
          style={{
            maxWidth: '340px',
            margin: '0 auto 20px',
            fontSize: '0.95rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
          }}
        >
          Snap the receipt, pick who had what, and share everyone's total.
        </p>

        {/* Primary CTA */}
        <div style={{ marginBottom: 10 }}>
          <Link
            to="/scan"
            className="btn-primary"
            style={{
              maxWidth: '320px',
              margin: '0 auto',
              fontSize: '1.05rem',
              fontWeight: 700,
              padding: '14px 24px',
              boxShadow: '0 4px 14px rgba(30, 58, 95, 0.2)',
            }}
          >
            <span>Scan your receipt →</span>
          </Link>
        </div>

        {/* Reassurance */}
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            margin: 0,
          }}
        >
          No account needed.
        </p>
      </section>

      {/* How It Works Section (01 SNAP · 02 PICK · 03 SHARE) */}
      <section
        aria-label="How it works"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 16px',
          marginBottom: 20,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-text-muted)',
            marginBottom: 14,
            textAlign: 'center',
          }}
        >
          How it works
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Step 01 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 12px',
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
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SNAP
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
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
              padding: '10px 12px',
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
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                PICK
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
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
              padding: '10px 12px',
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
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SHARE
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Everyone sees exactly what they owe.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Installation Section ("Take TabSplit with you") */}
      <section
        aria-label="Install TabSplit"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 16px',
          marginBottom: 20,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 800,
              color: 'var(--color-text)',
              marginBottom: 4,
              letterSpacing: '-0.01em',
            }}
          >
            Take TabSplit with you
          </div>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.45,
              maxWidth: '300px',
              margin: '0 auto',
            }}
          >
            Install TabSplit on your phone for quick access without going through the browser every time.
          </p>
        </div>

        {isInstalled ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 14px',
              backgroundColor: 'var(--color-success-bg)',
              border: '1px solid #a7f3d0',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-success)',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            <span>✓</span>
            <span>TabSplit is installed on this device</span>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={handleInstallClick}
              className="btn-secondary"
              style={{
                width: '100%',
                fontWeight: 700,
                fontSize: '0.95rem',
                minHeight: '44px',
                borderColor: 'var(--color-primary-border)',
                color: 'var(--color-primary)',
                backgroundColor: 'var(--color-primary-subtle)',
              }}
            >
              Install TabSplit
            </button>

            {/* Fallback installation guide when native prompt is not active or on iOS */}
            {showInstallGuide && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.825rem',
                  lineHeight: 1.45,
                  color: 'var(--color-text)',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--color-primary)' }}>
                  {platform === 'ios'
                    ? 'How to install on iPhone & iPad:'
                    : platform === 'android'
                    ? 'How to install on Android:'
                    : 'How to install:'}
                </div>

                {platform === 'ios' ? (
                  <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>Tap the <strong>Share</strong> button (box with upward arrow) in Safari.</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong> in the top-right corner.</li>
                  </ol>
                ) : platform === 'android' ? (
                  <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>Tap the <strong>three dots (⋮)</strong> in Chrome's top-right menu.</li>
                    <li>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                    <li>Confirm the prompt to add TabSplit to your home screen.</li>
                  </ol>
                ) : (
                  <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>Click the <strong>install icon (⊕)</strong> in your browser's address bar.</li>
                    <li>Or open your browser menu and click <strong>Install TabSplit</strong>.</li>
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Footer Proof Line */}
      <footer
        style={{
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        Handles solo plates, shared apps, tax & tip fairly.
      </footer>
    </div>
  );
}

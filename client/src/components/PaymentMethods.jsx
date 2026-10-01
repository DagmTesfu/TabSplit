import React, { useState } from 'react';
import {
  BANK_CONFIG,
  isMobileDevice,
  openBankingApp,
} from '../paymentAccounts';
import {
  getHostPaymentAccounts,
  saveHostPaymentAccounts,
} from '../storage';

export default function PaymentMethods({
  accounts: initialAccounts,
  onAccountsChange,
  isHost = false,
  restaurantName = '',
}) {
  const [accounts, setAccounts] = useState(() => {
    if (initialAccounts && (initialAccounts.telebirr || initialAccounts.cbe || initialAccounts.awash || initialAccounts.abyssinia)) {
      return initialAccounts;
    }
    return getHostPaymentAccounts();
  });

  const [activeBankId, setActiveBankId] = useState(() => {
    // Default to the first configured bank, or 'telebirr'
    if (accounts.telebirr) return 'telebirr';
    if (accounts.cbe) return 'cbe';
    if (accounts.awash) return 'awash';
    if (accounts.abyssinia) return 'abyssinia';
    return 'telebirr';
  });

  const [isEditing, setIsEditing] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [editForm, setEditForm] = useState(accounts);

  const activeBank = BANK_CONFIG[activeBankId] || BANK_CONFIG.telebirr;
  const currentNumber = accounts[activeBankId] || '';
  const isMobile = isMobileDevice();

  const handleCopy = async (val, key) => {
    if (!val) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(val);
      } else {
        const t = document.createElement('textarea');
        t.value = val;
        t.style.position = 'fixed';
        t.style.opacity = '0';
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setAccounts(editForm);
    saveHostPaymentAccounts(editForm);
    if (onAccountsChange) {
      onAccountsChange(editForm);
    }
    setIsEditing(false);
  };

  const hasAnyAccount = Boolean(
    accounts.telebirr || accounts.cbe || accounts.awash || accounts.abyssinia
  );

  if (!isHost && !hasAnyAccount) {
    return null;
  }

  return (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '1.1rem' }}>💳</span>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              color: 'var(--color-text)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {accounts.accountName ? `Pay ${accounts.accountName}` : 'How to Pay'}
          </span>
        </div>

        {isHost && (
          <button
            type="button"
            onClick={() => {
              setEditForm(accounts);
              setIsEditing((prev) => !prev);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {isEditing ? 'Cancel' : (hasAnyAccount ? 'Edit Accounts' : '+ Setup Accounts')}
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Enter your bank or Telebirr accounts so friends can transfer their share:
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: 2 }}>
              Account Holder Name
            </label>
            <input
              type="text"
              value={editForm.accountName || ''}
              onChange={(e) => setEditForm({ ...editForm, accountName: e.target.value })}
              placeholder="e.g. Dagmawi T."
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: 2, color: BANK_CONFIG.telebirr.color }}>
              📱 Telebirr Phone Number
            </label>
            <input
              type="text"
              value={editForm.telebirr || ''}
              onChange={(e) => setEditForm({ ...editForm, telebirr: e.target.value })}
              placeholder={BANK_CONFIG.telebirr.fieldPlaceholder}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: 2, color: BANK_CONFIG.cbe.color }}>
              🏦 CBE (Commercial Bank of Ethiopia) Account
            </label>
            <input
              type="text"
              value={editForm.cbe || ''}
              onChange={(e) => setEditForm({ ...editForm, cbe: e.target.value })}
              placeholder={BANK_CONFIG.cbe.fieldPlaceholder}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: 2, color: BANK_CONFIG.awash.color }}>
              🏢 Awash Bank Account
            </label>
            <input
              type="text"
              value={editForm.awash || ''}
              onChange={(e) => setEditForm({ ...editForm, awash: e.target.value })}
              placeholder={BANK_CONFIG.awash.fieldPlaceholder}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: 2, color: BANK_CONFIG.abyssinia.color }}>
              🏛️ Bank of Abyssinia (BoA) Account
            </label>
            <input
              type="text"
              value={editForm.abyssinia || ''}
              onChange={(e) => setEditForm({ ...editForm, abyssinia: e.target.value })}
              placeholder={BANK_CONFIG.abyssinia.fieldPlaceholder}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', minHeight: '38px', padding: '8px', fontSize: '0.85rem', fontWeight: 700, marginTop: 4 }}
          >
            Save Payment Details
          </button>
        </form>
      ) : (
        <div>
          {/* Bank Selection Tabs (Medium icon badges) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              marginBottom: 12,
            }}
          >
            {Object.values(BANK_CONFIG).map((bank) => {
              const isSelected = activeBankId === bank.id;
              const hasNum = Boolean(accounts[bank.id]);

              return (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => setActiveBankId(bank.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? `2px solid ${bank.color}` : '1.5px solid var(--color-border)',
                    backgroundColor: isSelected ? bank.bgColor : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: '1.25rem', marginBottom: 2 }}>{bank.iconText}</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: isSelected ? bank.color : 'var(--color-text)',
                      textAlign: 'center',
                      lineHeight: 1.1,
                    }}
                  >
                    {bank.badgeText}
                  </span>
                  {hasNum && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                      }}
                      title="Configured"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Bank Detail Box */}
          <div
            style={{
              backgroundColor: activeBank.bgColor,
              border: `1.5px solid ${activeBank.borderColor}`,
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: activeBank.color }}>
                {activeBank.label}
              </span>
              {accounts.accountName && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Name: {accounts.accountName}
                </span>
              )}
            </div>

            {currentNumber ? (
              <div>
                <div
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    color: 'var(--color-text)',
                    fontFamily: 'monospace',
                    marginBottom: 10,
                  }}
                >
                  {currentNumber}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentNumber, activeBank.id)}
                    style={{
                      flex: 1,
                      minHeight: '38px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: '#ffffff',
                      color: 'var(--color-text)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{copiedKey === activeBank.id ? '✓' : '📋'}</span>
                    <span>{copiedKey === activeBank.id ? 'Copied!' : 'Copy Account'}</span>
                  </button>

                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => openBankingApp(activeBank.appScheme)}
                      style={{
                        flex: 1,
                        minHeight: '38px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: activeBank.color,
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <span>🚀</span>
                      <span>Open {activeBank.name}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <p style={{ margin: '0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                  Host has not set up a {activeBank.name} account.
                </p>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm(accounts);
                      setIsEditing(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: activeBank.color,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      marginTop: 6,
                    }}
                  >
                    Add your {activeBank.name} account →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

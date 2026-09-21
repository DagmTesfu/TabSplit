import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

function currencySymbol(currency) {
  if (currency === 'USD') return '$';
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

export default function AssignPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const receipt = location.state?.receipt;
  const people = location.state?.people;

  const [assignments, setAssignments] = useState(() => {
    if (location.state?.assignments && typeof location.state.assignments === 'object') {
      return location.state.assignments;
    }
    const initial = {};
    if (Array.isArray(receipt?.items)) {
      receipt.items.forEach((item) => {
        initial[item.id] = Array.isArray(item.assignedTo) ? item.assignedTo : [];
      });
    }
    return initial;
  });

  if (!receipt || !Array.isArray(people) || people.length === 0) {
    return (
      <div className="page page-center">
        <h1 className="title">No Bill Found</h1>
        <p className="subtitle">
          Please add people before assigning items.
        </p>
        <Link to="/scan" className="btn-primary">
          Go to Scanner
        </Link>
      </div>
    );
  }

  const currency = receipt.currency ?? 'USD';
  const items = Array.isArray(receipt.items) ? receipt.items : [];

  const handleTogglePerson = (itemId, personId) => {
    setAssignments((prev) => {
      const current = prev[itemId] || [];
      const isAssigned = current.includes(personId);
      const updated = isAssigned
        ? current.filter((id) => id !== personId)
        : [...current, personId];
      return { ...prev, [itemId]: updated };
    });
  };

  const handleContinue = () => {
    navigate('/summary', {
      state: {
        receipt,
        people,
        assignments,
      },
    });
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <h1 className="title" style={{ marginBottom: 4 }}>
          Assign Items
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
          {receipt.restaurantName ? `${receipt.restaurantName} · ` : ''}
          {people.length} participant{people.length !== 1 ? 's' : ''} · {currency}
        </p>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
        Tap the person (or people) who will pay for each item.
      </p>

      {/* Items Assignment List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {items.map((item, index) => {
          const assignedIds = assignments[item.id] || [];
          const count = assignedIds.length;

          let statusLabel = 'Unassigned';
          let statusColor = 'var(--text-muted)';
          let statusBg = '#f1f5f9';

          if (count === 1) {
            const person = people.find((p) => p.id === assignedIds[0]);
            statusLabel = person ? `Assigned to ${person.name}` : 'Assigned to 1 person';
            statusColor = '#1d4ed8';
            statusBg = '#eff6ff';
          } else if (count > 1) {
            statusLabel = `Split between ${count} people`;
            statusColor = '#16a34a';
            statusBg = '#f0fdf4';
          }

          return (
            <div
              key={item.id || index}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Item Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 6,
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    flex: 1,
                    minWidth: 0,
                    wordBreak: 'break-word',
                  }}
                >
                  {item.quantity && item.quantity > 1 && (
                    <span style={{ color: 'var(--text-muted)', marginRight: 4, fontWeight: 600 }}>
                      {item.quantity} ×
                    </span>
                  )}
                  <span>{item.name || `Item ${index + 1}`}</span>
                </div>
                <div
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: item.priceMinor < 0 ? '#16a34a' : 'var(--text-main)',
                    flexShrink: 0,
                  }}
                >
                  {formatAmount(item.priceMinor ?? 0, currency)}
                </div>
              </div>

              {/* Status Badge */}
              <div style={{ marginBottom: 12 }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: statusBg,
                    color: statusColor,
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              {/* People Selection Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {people.map((person) => {
                  const isSelected = assignedIds.includes(person.id);

                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleTogglePerson(item.id, person.id)}
                      aria-pressed={isSelected}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: '44px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: isSelected
                          ? '1.5px solid var(--primary-color)'
                          : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            border: isSelected
                              ? '1.5px solid var(--primary-color)'
                              : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'var(--primary-color)' : '#ffffff',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {isSelected ? '✓' : ''}
                        </span>
                        <span
                          style={{
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? 'var(--primary-color)' : 'var(--text-main)',
                            fontSize: '0.95rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {person.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Continue to Summary */}
      <button
        type="button"
        onClick={handleContinue}
        className="btn-primary"
        style={{ marginBottom: 12 }}
      >
        Continue
      </button>

      {/* Back to People */}
      <button
        type="button"
        onClick={() => navigate('/people', { state: { receipt, people, assignments } })}
        className="btn-secondary"
        style={{ alignSelf: 'center' }}
      >
        ← Back to People
      </button>
    </div>
  );
}

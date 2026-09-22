import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getSessionData, updateSessionData } from '../session';
import { getAvatarColor, getInitials } from '../avatarColors';

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

let nextPersonCounter = 0;
function createPersonId() {
  nextPersonCounter += 1;
  return `p-${Date.now().toString(36)}-${nextPersonCounter}`;
}

function validatePersonName(name, currentPeople, excludeId = null) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Name cannot be blank.' };
  }
  if (trimmed.length > 60) {
    return { valid: false, error: 'Name must be 60 characters or fewer.' };
  }
  // Reject control characters (0x00-0x1F and 0x7F)
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return { valid: false, error: 'Name contains invalid characters.' };
  }
  const isDuplicate = currentPeople.some(
    (p) => p.id !== excludeId && p.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (isDuplicate) {
    return { valid: false, error: `"${trimmed}" has already been added.` };
  }
  return { valid: true, trimmed };
}

const inputBaseStyle = {
  padding: '10px 12px',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  fontSize: '1rem',
  color: 'var(--text-main)',
  backgroundColor: '#ffffff',
  outline: 'none',
  transition: 'border-color 0.15s ease',
};

export default function PeoplePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSessionData();
  const receipt = location.state?.receipt || session.receipt;

  const [people, setPeople] = useState(() =>
    Array.isArray(location.state?.people) && location.state.people.length > 0
      ? location.state.people
      : (Array.isArray(session.people) ? session.people : [])
  );
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    updateSessionData({ people });
  }, [people]);

  if (!receipt) {
    return (
      <div className="page page-center">
        <h1 className="title">No Receipt Found</h1>
        <p className="subtitle">
          Please scan and review a receipt before adding people.
        </p>
        <Link to="/scan" className="btn-primary">
          Go to Scanner
        </Link>
      </div>
    );
  }

  const itemsSubtotalMinor = Array.isArray(receipt.items)
    ? receipt.items.reduce((sum, item) => sum + (item.priceMinor ?? 0), 0)
    : 0;
  const chargesMinor = Array.isArray(receipt.additionalCharges)
    ? receipt.additionalCharges.reduce((sum, c) => sum + (c.amountMinor ?? 0), 0)
    : 0;
  const billTotalMinor =
    itemsSubtotalMinor +
    (receipt.taxInclusive ? 0 : (receipt.taxMinor ?? 0)) +
    (receipt.tipMinor ?? 0) +
    chargesMinor;

  const handleAddPerson = (e) => {
    if (e) e.preventDefault();
    const result = validatePersonName(newName, people);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError(null);
    setPeople((prev) => [...prev, { id: createPersonId(), name: result.trimmed }]);
    setNewName('');
  };

  const startEditing = (person) => {
    setEditingId(person.id);
    setEditingName(person.name);
    setError(null);
  };

  const saveEditing = (id) => {
    const result = validatePersonName(editingName, people, id);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError(null);
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: result.trimmed } : p))
    );
    setEditingId(null);
    setEditingName('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
    setError(null);
  };

  const handleRemovePerson = (id) => {
    setPeople((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) {
      cancelEditing();
    }
  };

  const handleContinue = () => {
    if (people.length === 0) {
      setError('Please add at least one person before continuing.');
      return;
    }
    setError(null);
    updateSessionData({ receipt, people });
    const assignments = location.state?.assignments || session.assignments;
    navigate('/assign', {
      state: {
        receipt,
        people,
        ...(assignments && Object.keys(assignments).length > 0 ? { assignments } : {}),
      },
    });
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <h1 className="title" style={{ marginBottom: 4 }}>
          People
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
          {receipt.restaurantName ? `${receipt.restaurantName} · ` : ''}
          {formatAmount(billTotalMinor, receipt.currency ?? 'USD')}
        </p>
      </div>

      {/* Add Person Form */}
      <form onSubmit={handleAddPerson} style={{ marginBottom: 20 }}>
        <label
          htmlFor="person-name-input"
          style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Add person
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="person-name-input"
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Dagm"
            maxLength={60}
            style={{ ...inputBaseStyle, flex: 1, minWidth: 0, minHeight: '44px' }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 16px',
              minHeight: '44px',
              backgroundColor: 'var(--primary-color)',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              touchAction: 'manipulation',
            }}
          >
            + Add
          </button>
        </div>
      </form>

      {/* Validation Error Message */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* People List Section */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Splitting with ({people.length})
          </span>
        </div>

        {people.length === 0 ? (
          <div
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
            }}
          >
            <p style={{ margin: 0, fontWeight: 500 }}>
              Add the people splitting this bill.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {people.map((person, index) => {
              const isEditing = editingId === person.id;

              return (
                <li
                  key={person.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '10px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    marginBottom: 8,
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditing(person.id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        maxLength={60}
                        autoFocus
                        style={{ ...inputBaseStyle, flex: 1, minWidth: 0, padding: '8px 10px', fontSize: '0.95rem', minHeight: '38px' }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEditing(person.id)}
                        style={{
                          padding: '8px 12px',
                          minHeight: '38px',
                          backgroundColor: 'var(--primary-color)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                          touchAction: 'manipulation',
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        style={{
                          padding: '8px 10px',
                          minHeight: '38px',
                          backgroundColor: '#f1f5f9',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          flexShrink: 0,
                          touchAction: 'manipulation',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        {(() => {
                          const avatar = getAvatarColor(person.id || person.name);
                          return (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: avatar.bg,
                                color: avatar.color,
                                border: `1px solid ${avatar.border}`,
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(person.name)}
                            </span>
                          );
                        })()}
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '1rem',
                            color: 'var(--text-main)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                          }}
                        >
                          {person.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => startEditing(person)}
                          aria-label={`Edit ${person.name}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary-color)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            padding: '8px 8px',
                            minHeight: '40px',
                            borderRadius: '4px',
                            touchAction: 'manipulation',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePerson(person.id)}
                          aria-label={`Remove ${person.name}`}
                          title="Remove person"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            padding: '8px 8px',
                            minHeight: '40px',
                            minWidth: '32px',
                            borderRadius: '4px',
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            touchAction: 'manipulation',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Continue Action */}
      <button
        type="button"
        onClick={handleContinue}
        className="btn-primary"
        style={{ marginBottom: 12 }}
      >
        Continue
      </button>

      {/* Back to Review */}
      <button
        type="button"
        onClick={() => {
          updateSessionData({ receipt, people });
          const assignments = location.state?.assignments || session.assignments;
          navigate('/review', {
            state: {
              receipt,
              people,
              ...(assignments && Object.keys(assignments).length > 0 ? { assignments } : {}),
            },
          });
        }}
        className="btn-secondary"
        style={{ alignSelf: 'center' }}
      >
        ← Back to Review
      </button>
    </div>
  );
}

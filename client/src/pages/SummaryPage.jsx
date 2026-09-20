import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const receipt = location.state?.receipt;
  const people = location.state?.people;
  const assignments = location.state?.assignments;

  if (!receipt || !Array.isArray(people) || !assignments) {
    return (
      <div className="page page-center">
        <h1 className="title">No Bill Found</h1>
        <p className="subtitle">
          Please assign items before viewing the summary.
        </p>
        <Link to="/scan" className="btn-primary">
          Go to Scanner
        </Link>
      </div>
    );
  }

  const totalAssignedCount = Object.values(assignments).filter(
    (assigned) => Array.isArray(assigned) && assigned.length > 0
  ).length;

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="title" style={{ marginBottom: 4 }}>
          Summary
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
          {receipt.restaurantName ? `${receipt.restaurantName} · ` : ''}
          {people.length} participant{people.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="placeholder-card">
        <div className="placeholder-icon">📊</div>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>Summary Step</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 8 }}>
          Assignment state received for {receipt.items?.length || 0} item{receipt.items?.length !== 1 ? 's' : ''} ({totalAssignedCount} assigned).
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Individual calculation and finalization will be implemented in the next slice.
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate('/assign', { state: { receipt, people, assignments } })}
        className="btn-secondary"
        style={{ alignSelf: 'center', marginTop: 16 }}
      >
        ← Back to Assign
      </button>
    </div>
  );
}

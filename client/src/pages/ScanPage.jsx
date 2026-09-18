import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ScanPage() {
  const [currency, setCurrency] = useState("ETB");
  return (
    <div className="page">
      <h1 className="title">Scan Receipt</h1>
      <p className="subtitle">
        Upload or snap a photo of your receipt to start itemizing.
      </p>


    <label htmlFor="currency">Currency</label>

    <select
      id="currency"
      value={currency}
      onChange={(event) => setCurrency(event.target.value)}
    >
      <option value="ETB">ETB</option>
      <option value="USD">USD</option>
    </select>
    
      <div className="placeholder-card">
        <div className="placeholder-icon">📸</div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Receipt Scanner</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Receipt upload & camera scan interface will be available here in Feature 5.2.
        </p>
      </div>

      <Link to="/" className="btn-secondary" style={{ alignSelf: 'center' }}>
        ← Back to Home
      </Link>
    </div>
  );
}

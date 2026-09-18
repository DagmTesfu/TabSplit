import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="page page-center">
      <h1 className="title">Split Bills Simply</h1>
      <p className="subtitle">
        Scan your receipt, assign items to friends, and calculate totals with tip and tax automatically.
      </p>
      <Link to="/scan" className="btn-primary">
        Start Splitting
      </Link>
    </div>
  );
}

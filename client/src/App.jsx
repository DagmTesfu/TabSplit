import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ScanPage from './pages/ScanPage';
import ReviewPage from './pages/ReviewPage';
import PeoplePage from './pages/PeoplePage';
import AssignPage from './pages/AssignPage';
import SummaryPage from './pages/SummaryPage';
import FinalizedPage from './pages/FinalizedPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="app-header">
          <Link to="/" className="brand-link">
            TabSplit
          </Link>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/assign" element={<AssignPage />} />
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/finalized" element={<FinalizedPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

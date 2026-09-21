import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractReceipt } from '../api';

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  fontSize: '1rem',
  color: 'var(--text-main)',
  backgroundColor: '#ffffff',
  outline: 'none',
  appearance: 'none',
  backgroundImage:
    'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: '10px',
  cursor: 'pointer',
};

export default function ScanPage() {
  const [currency, setCurrency] = useState('ETB');
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const navigate = useNavigate();
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024;

  useEffect(() => {
    if (!receiptFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(receiptFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [receiptFile]);

  const handleScan = async () => {
    if (!receiptFile) {
      setFileError('Please select or capture a receipt image first.');
      return;
    }

    try {
      setIsScanning(true);
      setScanError(null);
      setFileError(null);

      const data = await extractReceipt(receiptFile, currency);
      navigate('/review', { state: { receipt: data } });
    } catch (err) {
      setScanError(err.message || 'Failed to scan receipt. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="title" style={{ marginBottom: 4 }}>
          Scan Receipt
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
          Upload or photograph your receipt to extract items.
        </p>
      </div>

      {/* Currency Selector */}
      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="currency"
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
          Currency
        </label>
        <select
          id="currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          style={selectStyle}
        >
          <option value="ETB">ETB — Ethiopian Birr</option>
          <option value="USD">USD — US Dollar</option>
        </select>
      </div>

      {/* File Upload / Camera Input */}
      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="receipt-upload"
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
          Receipt Image
        </label>

        <input
          id="receipt-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files[0];
            if (!file) return;

            if (!allowedTypes.includes(file.type)) {
              setFileError('Please select a JPEG, PNG, or WebP image.');
              setReceiptFile(null);
              return;
            }

            if (file.size > maxSize) {
              setFileError('Receipt image must be 5 MB or smaller.');
              setReceiptFile(null);
              return;
            }

            setFileError(null);
            setScanError(null);
            setReceiptFile(file);
          }}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: 'var(--text-main)',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* File Validation Error */}
      {fileError && (
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
          {fileError}
        </div>
      )}

      {/* Receipt Image Preview */}
      {previewUrl && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img
            src={previewUrl}
            alt="Receipt preview"
            style={{
              maxWidth: '100%',
              maxHeight: '260px',
              objectFit: 'contain',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
            }}
          />
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setReceiptFile(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 10px',
              }}
            >
              Remove receipt
            </button>
          </div>
        </div>
      )}

      {/* Extraction Scan Error */}
      {scanError && (
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
          {scanError}
        </div>
      )}

      {/* Scan Button */}
      <button
        type="button"
        onClick={handleScan}
        disabled={isScanning || !receiptFile}
        className="btn-primary"
        style={{
          opacity: isScanning || !receiptFile ? 0.65 : 1,
          cursor: isScanning || !receiptFile ? 'not-allowed' : 'pointer',
          marginBottom: 16,
        }}
      >
        {isScanning ? 'Scanning...' : 'Scan Receipt'}
      </button>

      <Link
        to="/"
        className="btn-secondary"
        style={{ alignSelf: 'center', textDecoration: 'none' }}
      >
        ← Back to Home
      </Link>
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractReceipt } from '../api';
import { clearSessionData, updateSessionData } from '../session';

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

import {
  ALLOWED_IMAGE_TYPES,
  MAX_ORIGINAL_BYTES,
  MAX_OPTIMIZED_BYTES,
  isAllowedImageType,
  optimizeImageForScan,
  processReceiptFile,
} from '../imageOptimization.js';

export {
  ALLOWED_IMAGE_TYPES,
  MAX_ORIGINAL_BYTES,
  MAX_OPTIMIZED_BYTES,
  isAllowedImageType,
  optimizeImageForScan,
  processReceiptFile,
};

export default function ScanPage() {
  const [currency, setCurrency] = useState('ETB');
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState('');
  const [scanError, setScanError] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!receiptFile) {
      setPreviewUrl(null);
      return;
    }

    let url = null;
    try {
      url = URL.createObjectURL(receiptFile);
      setPreviewUrl(url);
    } catch (err) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target.result);
      };
      reader.readAsDataURL(receiptFile);
    }

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [receiptFile]);

  // Timers for positive progressive scanning milestones
  useEffect(() => {
    if (!isScanning) {
      setScanStatusMessage('');
      return;
    }

    setScanStatusMessage('Reading receipt image...');

    const timer1 = setTimeout(() => {
      setScanStatusMessage('Extracting items & prices...');
    }, 3500);

    const timer2 = setTimeout(() => {
      setScanStatusMessage('Verifying taxes & totals...');
    }, 9000);

    const timer3 = setTimeout(() => {
      setScanStatusMessage('Organizing bill breakdown...');
    }, 18000);

    const timer4 = setTimeout(() => {
      setScanStatusMessage('Finalizing receipt details...');
    }, 28000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [isScanning]);

  const handleScan = async () => {
    if (isScanning || !receiptFile) {
      if (!receiptFile) {
        setFileError('Please select or capture a receipt image first.');
      }
      return;
    }

    if (receiptFile.size > MAX_OPTIMIZED_BYTES) {
      setFileError('Receipt image must be 5 MB or smaller.');
      return;
    }

    try {
      setIsScanning(true);
      setScanError(null);
      setFileError(null);

      const data = await extractReceipt(receiptFile, currency);
      clearSessionData();
      updateSessionData({ receipt: data, people: [], assignments: {} });
      navigate('/review', { state: { receipt: data } });
    } catch (err) {
      setScanError(err.message || 'Receipt scanning failed. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileSelected = async (file) => {
    if (!file) return;

    setFileError(null);
    setScanError(null);

    const { file: processedFile, error } = await processReceiptFile(file);
    if (error) {
      setFileError(error);
      setReceiptFile(null);
      return;
    }

    setReceiptFile(processedFile);
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const openPicker = (inputRef) => {
    if (inputRef.current) {
      // Clear value so re-selecting the exact same image triggers onChange
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  const handleRemove = () => {
    if (isScanning) return;
    setReceiptFile(null);
    setPreviewUrl(null);
    setFileError(null);
    setScanError(null);
  };

  return (
    <div className="page">
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="title" style={{ marginBottom: 4 }}>
          Scan Receipt
        </h1>
        <p className="subtitle" style={{ marginBottom: 0 }}>
          Upload or take a photo of your receipt to extract items.
        </p>
      </div>

      {/* Currency Selector */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="currency" className="form-label">
          Currency
        </label>
        <select
          id="currency"
          className="form-select"
          value={currency}
          disabled={isScanning}
          onChange={(event) => setCurrency(event.target.value)}
          style={{
            opacity: isScanning ? 0.6 : 1,
            cursor: isScanning ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="ETB">ETB — Ethiopian Birr</option>
          <option value="USD">USD — US Dollar</option>
        </select>
      </div>

      {/* Hidden File Inputs for Camera and Gallery */}
      <input
        ref={cameraInputRef}
        id="camera-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={isScanning}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      <input
        ref={galleryInputRef}
        id="gallery-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={isScanning}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />

      {/* File Selection Card when no receipt is chosen */}
      {!receiptFile && (
        <div style={{ marginBottom: 20 }}>
          <label className="form-label">
            Receipt Image
          </label>

          <div className="card-dashed">
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🧾</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
              Add your receipt
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 18, maxWidth: '280px', margin: '0 auto 18px' }}>
              Take a photo or choose an existing receipt image from your gallery
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openPicker(cameraInputRef)}
                disabled={isScanning}
                className="btn-secondary"
                style={{
                  flex: '1 1 140px',
                  minHeight: '48px',
                  fontWeight: 700,
                  gap: 8,
                }}
              >
                <span>📸</span> Take a photo
              </button>

              <button
                type="button"
                onClick={() => openPicker(galleryInputRef)}
                disabled={isScanning}
                className="btn-secondary"
                style={{
                  flex: '1 1 140px',
                  minHeight: '48px',
                  fontWeight: 700,
                  gap: 8,
                }}
              >
                <span>🖼️</span> Choose gallery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Validation Error */}
      {fileError && (
        <div role="alert" className="alert-box alert-error">
          {fileError}
        </div>
      )}

      {/* Receipt Image Preview Card */}
      {previewUrl && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '100%',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: '#000000',
            }}
          >
            <img
              src={previewUrl}
              alt="Receipt preview"
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '260px',
                objectFit: 'contain',
                opacity: isScanning ? 0.8 : 1,
                transition: 'opacity 0.2s ease',
              }}
            />
            {isScanning && <div className="scanning-laser" />}
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => openPicker(galleryInputRef)}
              disabled={isScanning}
              className="btn-secondary"
              style={{
                fontSize: '0.85rem',
                padding: '6px 12px',
                minHeight: '38px',
                gap: 6,
              }}
            >
              <span>🖼️</span> Change image
            </button>

            <button
              type="button"
              onClick={() => openPicker(cameraInputRef)}
              disabled={isScanning}
              className="btn-secondary"
              style={{
                fontSize: '0.85rem',
                padding: '6px 12px',
                minHeight: '38px',
                gap: 6,
              }}
            >
              <span>📸</span> Retake photo
            </button>

            <button
              type="button"
              onClick={handleRemove}
              disabled={isScanning}
              className="btn-danger-ghost"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Loading & Status Message Card */}
      {isScanning && (
        <div className="alert-box alert-info" style={{ padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="spinner" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e3a8a' }}>
                Scanning Receipt
              </div>
              <div style={{ fontSize: '0.85rem', color: '#2563eb', marginTop: 2, fontWeight: 500 }}>
                {scanStatusMessage || 'Reading receipt image...'}
              </div>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-bar" />
          </div>
        </div>
      )}

      {/* Extraction Scan Error with Retry Guidance */}
      {scanError && !isScanning && (
        <div role="alert" className="alert-box alert-error" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Scan Failed</div>
          <div>{scanError}</div>
        </div>
      )}

      {/* Scan / Retry Button */}
      <button
        type="button"
        onClick={handleScan}
        disabled={isScanning || !receiptFile}
        className="btn-primary"
        style={{
          marginBottom: 16,
        }}
      >
        {isScanning ? 'Reading Receipt...' : (scanError && receiptFile ? 'Try Again' : 'Scan Receipt')}
      </button>

      <Link
        to="/"
        className="btn-secondary"
        style={{
          alignSelf: 'center',
          textDecoration: 'none',
          pointerEvents: isScanning ? 'none' : 'auto',
          opacity: isScanning ? 0.6 : 1,
        }}
      >
        ← Back to Home
      </Link>
    </div>
  );
}

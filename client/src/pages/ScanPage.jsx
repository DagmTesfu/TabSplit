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

async function optimizeImageForScan(file) {
  if (!file || typeof window === 'undefined' || typeof Image === 'undefined') return file;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1600;
      let { width, height } = img;

      // If already within optimal dimensions, use original
      if (width <= maxDim && height <= maxDim && file.size <= 1024 * 1024) {
        resolve(file);
        return;
      }

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const cleanName = (file.name || 'receipt.jpg').replace(/\.[^/.]+$/, '') + '.jpg';
              resolve(new File([blob], cleanName, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

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
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024;

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

  const isAllowedImageType = (file) => {
    if (!file) return false;
    if (allowedTypes.includes(file.type)) return true;
    // Android Gallery fallback: check filename extension if MIME type is missing or generic
    const name = (file.name || '').toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
  };

  const handleFileSelected = async (file) => {
    if (!file) return;

    if (!isAllowedImageType(file)) {
      setFileError('Please select a JPEG, PNG, or WebP image.');
      setReceiptFile(null);
      return;
    }

    if (file.size > maxSize) {
      setFileError('Receipt image must be 5 MB or smaller.');
      setReceiptFile(null);
      return;
    }

    // Ensure normalized MIME type for mobile browsers (e.g. image/jpg or empty string -> image/jpeg)
    let normalizedFile = file;
    let mimeType = file.type;
    if (!mimeType || mimeType === 'image/jpg' || mimeType === 'image/pjpeg') {
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.png')) mimeType = 'image/png';
      else if (name.endsWith('.webp')) mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
      normalizedFile = new File([file], file.name || 'receipt.jpg', { type: mimeType });
    }

    setFileError(null);
    setScanError(null);

    // Optimize high-resolution phone camera photos for fast upload and high AI accuracy
    try {
      normalizedFile = await optimizeImageForScan(normalizedFile);
    } catch {
      // If optimization fails, fallback to normalized file
    }

    setReceiptFile(normalizedFile);
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
      <div style={{ marginBottom: 24 }}>
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
          disabled={isScanning}
          onChange={(event) => setCurrency(event.target.value)}
          style={{
            ...selectStyle,
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
          <label
            style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Receipt Image
          </label>

          <div
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: '#fafbfc',
            }}
          >
            <div style={{ fontSize: '2.25rem', marginBottom: 8 }}>🧾</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Add your receipt
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 18 }}>
              Take a photo with your camera or select an image from your gallery
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openPicker(cameraInputRef)}
                disabled={isScanning}
                style={{
                  flex: '1 1 140px',
                  minHeight: '48px',
                  padding: '10px 16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  touchAction: 'manipulation',
                }}
              >
                <span>📸</span> Take a photo
              </button>

              <button
                type="button"
                onClick={() => openPicker(galleryInputRef)}
                disabled={isScanning}
                style={{
                  flex: '1 1 140px',
                  minHeight: '48px',
                  padding: '10px 16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  touchAction: 'manipulation',
                }}
              >
                <span>🖼️</span> Choose from gallery
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--border-color)',
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
                opacity: isScanning ? 0.85 : 1,
                transition: 'opacity 0.2s ease',
              }}
            />
            {isScanning && <div className="scanning-laser" />}
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => openPicker(galleryInputRef)}
              disabled={isScanning}
              style={{
                background: '#f1f5f9',
                border: '1px solid var(--border-color)',
                color: isScanning ? 'var(--text-muted)' : 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isScanning ? 'not-allowed' : 'pointer',
                padding: '6px 12px',
                borderRadius: '6px',
                minHeight: '34px',
                touchAction: 'manipulation',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>🖼️</span> Change receipt
            </button>

            <button
              type="button"
              onClick={() => openPicker(cameraInputRef)}
              disabled={isScanning}
              style={{
                background: '#f1f5f9',
                border: '1px solid var(--border-color)',
                color: isScanning ? 'var(--text-muted)' : 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isScanning ? 'not-allowed' : 'pointer',
                padding: '6px 12px',
                borderRadius: '6px',
                minHeight: '34px',
                touchAction: 'manipulation',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>📸</span> Take new photo
            </button>

            <button
              type="button"
              onClick={handleRemove}
              disabled={isScanning}
              style={{
                background: 'none',
                border: 'none',
                color: isScanning ? 'var(--text-muted)' : '#dc2626',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isScanning ? 'not-allowed' : 'pointer',
                padding: '6px 10px',
                minHeight: '34px',
                touchAction: 'manipulation',
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Loading & Status Message Card */}
      {isScanning && (
        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: 16,
            color: '#1e40af',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="spinner" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e3a8a' }}>
                Scanning Receipt
              </div>
              <div style={{ fontSize: '0.85rem', color: '#3b82f6', marginTop: 2, fontWeight: 500 }}>
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
        <div
          role="alert"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: 16,
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Scan Failed</div>
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
          opacity: isScanning || !receiptFile ? 0.65 : 1,
          cursor: isScanning || !receiptFile ? 'not-allowed' : 'pointer',
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

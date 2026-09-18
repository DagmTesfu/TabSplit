import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function ScanPage() {
  const [currency, setCurrency] = useState("ETB");
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

   useEffect(() => {
        if(!receiptFile){
          setPreviewUrl(null);
          return;
        }

        const url = URL.createObjectURL(receiptFile);
        setPreviewUrl(url);

        return ()=> {
          URL.revokeObjectURL(url);
        }

    }, [receiptFile])


  

  return (
    <div className="page">
      <h1 className="title">Scan Receipt</h1>
      <p className="subtitle">
        
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

    <input 
    type='file'
    accept='image/jpeg,image/png,image/webp'
    capture="environment"
    onChange={(event)=> {
      setReceiptFile(event.target.files[0] || null)
    }}
    />

    {previewUrl && (
      <img src={previewUrl} alt="Receipt preview" />
    )}


      <div className="placeholder-card">
        <div className="placeholder-icon">📸</div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Receipt Scanner</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          
        </p>
      </div>

      <Link to="/" className="btn-secondary" style={{ alignSelf: 'center' }}>
        ← Back to Home
      </Link>
    </div>
  );
}

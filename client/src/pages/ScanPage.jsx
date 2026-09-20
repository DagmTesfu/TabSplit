import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractReceipt } from "../api";

export default function ScanPage() {
  const [currency, setCurrency] = useState("ETB");
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const navigate = useNavigate();
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024;

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


    const handleScan = async () => {

      try{
      console.log("handleScan clicked");

      setIsScanning(true);
      setScanError(null);

      const data = await extractReceipt(receiptFile, currency);
      navigate('/review', { state: { receipt: data } });
      } catch(err){
        setScanError(err.message)
      }finally{
        setIsScanning(false);
      }
    }

  

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
      const file = event.target.files[0];
      

    
    if (!file) {
      return;
    } else if(!allowedTypes.includes(file.type)){
        setFileError("Please select a JPEG, PNG, or WebP image.");
        setReceiptFile(null);
        return;
    } else if(file.size > maxSize){
      setFileError("Receipt image must be 5 MB or smaller.");
      setReceiptFile(null);
      return;
    } 

    setFileError(null);
    setReceiptFile(file)
    }}
    />

    {fileError && <p>{fileError}</p>}

    {previewUrl && (
      <img src={previewUrl} alt="Receipt preview" />
    )}

    {receiptFile && (
    <button onClick={() => setReceiptFile(null)}>
      Remove receipt
    </button>
  )}

      <button
        onClick={handleScan}
        disabled={isScanning}
      >
        {isScanning ? "Scanning..." : "Scan Receipt"}
      </button>

      {scanError && <p style={{ color: '#dc2626', marginTop: 8 }}>{scanError}</p>}


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

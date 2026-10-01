import React, { useState } from 'react';
import telebirrImg from '../assets/banks/telebirr.png';
import cbeImg from '../assets/banks/cbe.png';
import awashImg from '../assets/banks/awash.svg';
import boaImg from '../assets/banks/boa.jpg';

export const BANK_IMAGE_MAP = {
  telebirr: {
    src: telebirrImg,
    alt: 'Telebirr Logo',
    label: 'Telebirr',
    bgColor: '#ffffff',
  },
  cbe: {
    src: cbeImg,
    alt: 'Commercial Bank of Ethiopia Logo',
    label: 'CBE',
    bgColor: '#ffffff',
  },
  awash: {
    src: awashImg,
    alt: 'Awash Bank Logo',
    label: 'Awash Bank',
    bgColor: '#ffffff',
  },
  abyssinia: {
    src: boaImg,
    alt: 'Bank of Abyssinia Logo',
    label: 'Bank of Abyssinia',
    bgColor: '#ffffff',
  },
};

export function BankLogo({ bankId, size = 32, className = '' }) {
  const [hasError, setHasError] = useState(false);
  const info = BANK_IMAGE_MAP[bankId];

  if (!info) return null;

  const borderRadius = Math.max(6, Math.round(size * 0.22));
  const padding = Math.max(2, Math.round(size * 0.06));

  if (hasError) {
    // Graceful fallback to initial badge
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: '#f1f5f9',
          color: '#334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: Math.round(size * 0.4),
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}
      >
        {info.label.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: info.bgColor || '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        boxSizing: 'border-box',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={info.src}
        alt={info.alt}
        onError={() => setHasError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );
}

export default BankLogo;

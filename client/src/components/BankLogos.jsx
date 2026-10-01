import React from 'react';

/**
 * High-fidelity vector logos for Ethiopian financial institutions:
 * - Telebirr (Ethio Telecom mobile money)
 * - Commercial Bank of Ethiopia (CBE)
 * - Awash Bank
 * - Bank of Abyssinia (BoA)
 */

export function TelebirrLogo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Telebirr logo"
    >
      <defs>
        <linearGradient id="tb-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0072ce" />
          <stop offset="100%" stopColor="#00a859" />
        </linearGradient>
        <linearGradient id="tb-swirl-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="tb-swirl-green" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {/* App icon badge */}
      <rect width="48" height="48" rx="12" fill="url(#tb-bg)" />

      {/* Outer dual-arc mobile swirl */}
      <path
        d="M24 8C15.163 8 8 15.163 8 24C8 28.418 9.791 32.418 12.686 35.314L16.222 31.778C14.225 29.781 13 27.031 13 24C13 17.925 17.925 13 24 13C27.031 13 29.781 14.225 31.778 16.222L35.314 12.686C32.418 9.791 28.418 8 24 8Z"
        fill="url(#tb-swirl-cyan)"
        opacity="0.95"
      />
      <path
        d="M24 40C32.837 40 40 32.837 40 24C40 19.582 38.209 15.582 35.314 12.686L31.778 16.222C33.775 18.219 35 20.969 35 24C35 30.075 30.075 35 24 35C20.969 35 18.219 33.775 16.222 31.778L12.686 35.314C15.582 38.209 19.582 40 24 40Z"
        fill="url(#tb-swirl-green)"
        opacity="0.95"
      />

      {/* Center telebirr stylized "tb" coin */}
      <circle cx="24" cy="24" r="7.5" fill="#ffffff" />
      {/* Central phone / mobile currency spark */}
      <path
        d="M21 21C21 19.895 21.895 19 23 19H25C26.105 19 27 19.895 27 21V27C27 28.105 26.105 29 25 29H23C21.895 29 21 28.105 21 27V21Z"
        fill="#00843D"
      />
      <circle cx="24" cy="26.5" r="1" fill="#ffffff" />
      <rect x="23" y="20.5" width="2" height="0.8" rx="0.4" fill="#ffffff" />
    </svg>
  );
}

export function CBELogo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Commercial Bank of Ethiopia logo"
    >
      <defs>
        <linearGradient id="cbe-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#79288a" />
          <stop offset="100%" stopColor="#531663" />
        </linearGradient>
        <linearGradient id="cbe-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* Deep purple badge */}
      <rect width="48" height="48" rx="12" fill="url(#cbe-bg)" />

      {/* Gold outer border ring */}
      <rect x="4" y="4" width="40" height="40" rx="9" stroke="url(#cbe-gold)" strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Iconic CBE Balance Scales (Scales of Justice & Stability) */}
      {/* Center finial / apex */}
      <circle cx="24" cy="11.5" r="2.2" fill="url(#cbe-gold)" />

      {/* Main horizontal beam */}
      <path
        d="M12 16.5C12 15.948 12.448 15.5 13 15.5H35C35.552 15.5 36 15.948 36 16.5C36 17.052 35.552 17.5 35 17.5H13C12.448 17.5 12 17.052 12 16.5Z"
        fill="url(#cbe-gold)"
      />

      {/* Center column / pillar */}
      <path
        d="M23 15.5H25V33H23V15.5Z"
        fill="url(#cbe-gold)"
      />

      {/* Pillar base plinth */}
      <path
        d="M19 33H29V35H19V33Z"
        fill="url(#cbe-gold)"
      />
      <path
        d="M16 35H32V37H16V35Z"
        fill="url(#cbe-gold)"
      />

      {/* Left scale strings & pan */}
      <path d="M14 17.5L10.5 25H17.5L14 17.5Z" stroke="url(#cbe-gold)" strokeWidth="1" fill="none" />
      <path d="M9 25C9 27.2 11.2 29 14 29C16.8 29 19 27.2 19 25H9Z" fill="url(#cbe-gold)" />

      {/* Right scale strings & pan */}
      <path d="M34 17.5L30.5 25H37.5L34 17.5Z" stroke="url(#cbe-gold)" strokeWidth="1" fill="none" />
      <path d="M29 25C29 27.2 31.2 29 34 29C36.8 29 39 27.2 39 25H29Z" fill="url(#cbe-gold)" />
    </svg>
  );
}

export function AwashLogo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Awash Bank logo"
    >
      <defs>
        <linearGradient id="awash-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#005596" />
          <stop offset="100%" stopColor="#003366" />
        </linearGradient>
        <linearGradient id="awash-orange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffb81c" />
          <stop offset="100%" stopColor="#f58220" />
        </linearGradient>
      </defs>
      {/* Royal blue badge */}
      <rect width="48" height="48" rx="12" fill="url(#awash-bg)" />

      {/* Awash golden rising sun/arch */}
      <path
        d="M24 10C31.732 10 38 16.268 38 24C38 26.541 37.322 28.924 36.141 30.982C34.789 25.132 30.158 20.65 24 20.65C17.842 20.65 13.211 25.132 11.859 30.982C10.678 28.924 10 26.541 10 24C10 16.268 16.268 10 24 10Z"
        fill="url(#awash-orange)"
      />

      {/* Soaring Awash Chevron / Eagle Wing arch */}
      <path
        d="M24 15L35 34H29.5L24 24.5L18.5 34H13L24 15Z"
        fill="#ffffff"
      />

      {/* Center dynamic blue river stream */}
      <path
        d="M24 21L27.5 31H20.5L24 21Z"
        fill="url(#awash-bg)"
      />

      {/* Base baseline */}
      <rect x="12" y="35" width="24" height="2" rx="1" fill="url(#awash-orange)" />
    </svg>
  );
}

export function AbyssiniaLogo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Bank of Abyssinia logo"
    >
      <defs>
        <linearGradient id="boa-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2c2416" />
          <stop offset="100%" stopColor="#14110b" />
        </linearGradient>
        <linearGradient id="boa-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fad02c" />
          <stop offset="50%" stopColor="#e5a93c" />
          <stop offset="100%" stopColor="#c58917" />
        </linearGradient>
      </defs>
      {/* Dark luxury badge */}
      <rect width="48" height="48" rx="12" fill="url(#boa-bg)" />
      <rect x="3" y="3" width="42" height="42" rx="10" stroke="url(#boa-gold)" strokeWidth="1.5" strokeOpacity="0.45" />

      {/* Iconic BoA Golden Lion Emblem */}
      {/* Lion Crown / Apex mane */}
      <path
        d="M24 10L27 14L31 11L30 16L34 16.5L30.5 19.5L32 23L27.5 21.5L26 25L24 22L22 25L20.5 21.5L16 23L17.5 19.5L14 16.5L18 16L17 11L21 14L24 10Z"
        fill="url(#boa-gold)"
      />

      {/* Lion Face & Mane */}
      <path
        d="M24 18C28.418 18 32 21.582 32 26C32 30.418 28.418 34 24 34C19.582 34 16 30.418 16 26C16 21.582 19.582 18 24 18Z"
        fill="url(#boa-gold)"
        opacity="0.25"
      />

      {/* Noble lion nose, muzzle and eyes */}
      {/* Eyes */}
      <ellipse cx="20.5" cy="24" rx="1.5" ry="1.2" fill="url(#boa-gold)" />
      <ellipse cx="27.5" cy="24" rx="1.5" ry="1.2" fill="url(#boa-gold)" />

      {/* Nose bridge & muzzle */}
      <path
        d="M23 23.5H25L25.5 27.5L24 29L22.5 27.5L23 23.5Z"
        fill="url(#boa-gold)"
      />

      {/* Muzzle whiskers/curve */}
      <path
        d="M21 28.5C21.8 28.5 22.8 29.5 24 29.5C25.2 29.5 26.2 28.5 27 28.5C27.5 29.8 26.5 31.5 24 31.5C21.5 31.5 20.5 29.8 21 28.5Z"
        fill="url(#boa-gold)"
      />

      {/* Lower chin & mane tuft */}
      <path
        d="M24 31.5L25.5 35L24 37L22.5 35L24 31.5Z"
        fill="url(#boa-gold)"
      />

      {/* Flanking mane tufts */}
      <path d="M16 25C14 27 15 30 17 32" stroke="url(#boa-gold)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32 25C34 27 33 30 31 32" stroke="url(#boa-gold)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BankLogo({ bankId, size = 28, className = '' }) {
  switch (bankId) {
    case 'telebirr':
      return <TelebirrLogo size={size} className={className} />;
    case 'cbe':
      return <CBELogo size={size} className={className} />;
    case 'awash':
      return <AwashLogo size={size} className={className} />;
    case 'abyssinia':
      return <AbyssiniaLogo size={size} className={className} />;
    default:
      return null;
  }
}

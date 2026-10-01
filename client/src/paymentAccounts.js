// Ethiopian payment accounts and mobile banking app redirect helpers.
// Encodes/decodes accounts safely into share URL hash so payment details
// travel seamlessly with shared bills with zero database migration needed.

export const BANK_CONFIG = {
  telebirr: {
    id: 'telebirr',
    name: 'Telebirr',
    label: 'Telebirr (Ethio Telecom)',
    badgeText: 'Telebirr',
    iconText: '📱',
    color: '#00843D',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    appScheme: 'telebirr://',
    fieldPlaceholder: 'e.g. 0911234567 (Phone)',
  },
  cbe: {
    id: 'cbe',
    name: 'CBE',
    label: 'Commercial Bank of Ethiopia',
    badgeText: 'CBE',
    iconText: '🏦',
    color: '#79288a',
    bgColor: '#fbf5ff',
    borderColor: '#e9d5ff',
    appScheme: 'cbebirr://',
    fieldPlaceholder: 'e.g. 1000123456789 (Account)',
  },
  awash: {
    id: 'awash',
    name: 'Awash Bank',
    label: 'Awash Bank (Awash Birr)',
    badgeText: 'Awash',
    iconText: '🏢',
    color: '#005596',
    bgColor: '#f0f7ff',
    borderColor: '#bae6fd',
    appScheme: 'awashbirr://',
    fieldPlaceholder: 'e.g. 01320123456700 (Account)',
  },
  abyssinia: {
    id: 'abyssinia',
    name: 'Bank of Abyssinia',
    label: 'Bank of Abyssinia (BoA)',
    badgeText: 'Abyssinia',
    iconText: '🏛️',
    color: '#c58917',
    bgColor: '#fffdf5',
    borderColor: '#fde68a',
    appScheme: 'boamobile://',
    fieldPlaceholder: 'e.g. 87654321 (Account)',
  },
};

export function encodePaymentHash(accounts) {
  if (!accounts) return '';
  const obj = {
    n: (accounts.accountName || '').trim(),
    t: (accounts.telebirr || '').trim(),
    c: (accounts.cbe || '').trim(),
    w: (accounts.awash || '').trim(),
    b: (accounts.abyssinia || '').trim(),
  };
  if (!obj.n && !obj.t && !obj.c && !obj.w && !obj.b) return '';
  try {
    const json = JSON.stringify(obj);
    return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
  } catch {
    return '';
  }
}

export function decodePaymentHash(hashOrSearch) {
  if (!hashOrSearch) return null;
  let raw = '';
  if (hashOrSearch.includes('pay=')) {
    const match = hashOrSearch.match(/pay=([^&#]+)/);
    if (match) raw = match[1];
  } else if (hashOrSearch.startsWith('#')) {
    raw = hashOrSearch.slice(1);
  } else {
    raw = hashOrSearch;
  }
  if (!raw) return null;

  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(raw))));
    const parsed = JSON.parse(json);
    return {
      accountName: parsed.n || '',
      telebirr: parsed.t || '',
      cbe: parsed.c || '',
      awash: parsed.w || '',
      abyssinia: parsed.b || '',
    };
  } catch {
    return null;
  }
}

export function isMobileDevice() {
  if (typeof window === 'undefined' || !window.navigator) return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export function openBankingApp(scheme) {
  if (typeof window === 'undefined') return;
  // Attempt deep-link URL on mobile
  window.location.href = scheme;
}

// Persistent client-side storage for local personalization and bill history.
// Uses localStorage with safe fallback for privacy mode / non-browser environments.

const MY_NAME_KEY = 'tabsplit_my_name';
const RECENT_PEOPLE_KEY = 'tabsplit_recent_people';
const BILL_HISTORY_KEY = 'tabsplit_bill_history';

// In-memory fallback if localStorage is unavailable (e.g. strict private mode or node tests)
const memoryStore = {};

function getStoreItem(key) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Fallback to memoryStore
    }
  }
  return memoryStore[key] || null;
}

function setStoreItem(key, value) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // Fallback to memoryStore
    }
  }
  memoryStore[key] = value;
}

function removeStoreItem(key) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch {
      // Fallback to memoryStore
    }
  }
  delete memoryStore[key];
}

// 1. User's Personal Name ("Remember my name")
export function getMyName() {
  const val = getStoreItem(MY_NAME_KEY);
  return typeof val === 'string' ? val.trim() : '';
}

export function setMyName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed) {
    setStoreItem(MY_NAME_KEY, trimmed);
  } else {
    removeStoreItem(MY_NAME_KEY);
  }
}

// 2. Recent Friends/People (Quick-tap chips on People page)
export function getRecentPeople() {
  try {
    const raw = getStoreItem(RECENT_PEOPLE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentPeople(newNames) {
  try {
    const existing = getRecentPeople();
    const cleanList = (Array.isArray(newNames) ? newNames : [newNames])
      .map((n) => (typeof n === 'string' ? n.trim() : (n?.name || '').trim()))
      .filter((n) => n.length > 0 && n.length <= 60);

    const merged = [];
    const seen = new Set();
    for (const name of [...cleanList, ...existing]) {
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        merged.push(name);
      }
      if (merged.length >= 10) break;
    }
    setStoreItem(RECENT_PEOPLE_KEY, JSON.stringify(merged));
  } catch {}
}

// 3. Bill History (Local list of recent bills)
export function getBillHistory() {
  try {
    const raw = getStoreItem(BILL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBillToHistory(billInfo) {
  if (!billInfo || !billInfo.shareCode) return;
  try {
    const history = getBillHistory();
    const code = String(billInfo.shareCode).trim();
    const existing = history.find((b) => b.shareCode === code);
    // If the bill was created by this user/device, keep role as 'created'
    const role = (existing && existing.role === 'created') ? 'created' : (billInfo.role === 'created' ? 'created' : 'viewed');

    const entry = {
      shareCode: code,
      restaurantName: String(billInfo.restaurantName || '').trim() || 'Receipt Split',
      currency: String(billInfo.currency || 'USD').trim(),
      totalMinor: typeof billInfo.totalMinor === 'number' ? billInfo.totalMinor : 0,
      participantCount: typeof billInfo.participantCount === 'number' ? billInfo.participantCount : 0,
      createdAt: typeof billInfo.createdAt === 'number' ? billInfo.createdAt : Date.now(),
      role,
    };

    // Remove existing entry with the same shareCode to move it to the top
    const filtered = history.filter((b) => b.shareCode !== entry.shareCode);
    const updated = [entry, ...filtered].slice(0, 10);
    setStoreItem(BILL_HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

export function isBillHost(shareCode) {
  if (!shareCode) return false;
  try {
    const history = getBillHistory();
    const found = history.find((b) => b.shareCode === String(shareCode).trim());
    return found ? found.role === 'created' : false;
  } catch {
    return false;
  }
}

export function removeBillFromHistory(shareCode) {
  if (!shareCode) return;
  try {
    const history = getBillHistory();
    const updated = history.filter((b) => b.shareCode !== shareCode);
    setStoreItem(BILL_HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

export function clearBillHistory() {
  removeStoreItem(BILL_HISTORY_KEY);
}

// 4. Host Payment Accounts (Telebirr, CBE, Awash, Abyssinia)
const PAYMENT_ACCOUNTS_KEY = 'tabsplit_host_payment_accounts';

export function getHostPaymentAccounts() {
  try {
    const raw = getStoreItem(PAYMENT_ACCOUNTS_KEY);
    if (!raw) return { accountName: '', telebirr: '', cbe: '', awash: '', abyssinia: '' };
    const parsed = JSON.parse(raw);
    return {
      accountName: typeof parsed.accountName === 'string' ? parsed.accountName.trim() : '',
      telebirr: typeof parsed.telebirr === 'string' ? parsed.telebirr.trim() : '',
      cbe: typeof parsed.cbe === 'string' ? parsed.cbe.trim() : '',
      awash: typeof parsed.awash === 'string' ? parsed.awash.trim() : '',
      abyssinia: typeof parsed.abyssinia === 'string' ? parsed.abyssinia.trim() : '',
    };
  } catch {
    return { accountName: '', telebirr: '', cbe: '', awash: '', abyssinia: '' };
  }
}

export function saveHostPaymentAccounts(accounts) {
  if (!accounts || typeof accounts !== 'object') return;
  try {
    const clean = {
      accountName: typeof accounts.accountName === 'string' ? accounts.accountName.trim() : '',
      telebirr: typeof accounts.telebirr === 'string' ? accounts.telebirr.trim() : '',
      cbe: typeof accounts.cbe === 'string' ? accounts.cbe.trim() : '',
      awash: typeof accounts.awash === 'string' ? accounts.awash.trim() : '',
      abyssinia: typeof accounts.abyssinia === 'string' ? accounts.abyssinia.trim() : '',
    };
    setStoreItem(PAYMENT_ACCOUNTS_KEY, JSON.stringify(clean));
  } catch {}
}

// 5. "I already paid" per-person tracking per bill
const PAID_STATUS_PREFIX = 'tabsplit_paid_';

export function getPaidStatus(shareCode) {
  if (!shareCode) return {};
  try {
    const raw = getStoreItem(`${PAID_STATUS_PREFIX}${shareCode}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setPersonPaidStatus(shareCode, personId, isPaid) {
  if (!shareCode || !personId) return;
  try {
    const current = getPaidStatus(shareCode);
    const updated = { ...current, [personId]: Boolean(isPaid) };
    setStoreItem(`${PAID_STATUS_PREFIX}${shareCode}`, JSON.stringify(updated));
  } catch {}
}


const STORAGE_KEY = 'tabsplit_session_data';

export function getSessionData() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { receipt: null, people: [], assignments: {} };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { receipt: null, people: [], assignments: {} };
    const parsed = JSON.parse(raw);
    return {
      receipt: parsed.receipt || null,
      people: Array.isArray(parsed.people) ? parsed.people : [],
      assignments: (parsed.assignments && typeof parsed.assignments === 'object') ? parsed.assignments : {},
    };
  } catch {
    return { receipt: null, people: [], assignments: {} };
  }
}

export function updateSessionData(partial) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const current = getSessionData();
    const updated = { ...current, ...partial };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSessionData() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

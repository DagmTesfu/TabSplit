import axios from 'axios';

export function getApiUrl(path) {
  const base = (import.meta.env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const cleanBase = base.endsWith('/api') ? base.slice(0, -4) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export async function extractReceipt(receiptFile, currency) {
  const URL = getApiUrl('/api/extract-receipt');

  const formData = new FormData();
  formData.append('image', receiptFile);
  formData.append('currency', currency);

  try {
    const response = await axios.post(URL, formData, { timeout: 70000 });
    return response.data;
  } catch (err) {
    let message = err.message || 'Failed to scan receipt. Please try again.';
    if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
      message = 'Receipt extraction timed out. Please check your connection and try again.';
    } else if (err.response?.data?.error) {
      message = err.response.data.error;
    } else if (err.response?.status === 413) {
      message = 'Receipt image is too large (max 5 MB).';
    } else if (err.response?.status === 429) {
      message = 'Too many receipt extraction requests. Please try again later.';
    } else if (err.response?.status === 422) {
      message = 'The receipt could not be read completely. Try a clearer photo.';
    } else if (err.response?.status === 503) {
      message = err.response.data?.error || 'Receipt scanning is temporarily unavailable. Please try again later.';
    } else if (err.response?.status === 502 || err.response?.status === 504) {
      message = err.response.data?.error || 'Could not read receipt from vision provider. Please try again.';
    }
    const error = new Error(message);
    error.code = err.response?.data?.code || (err.code === 'ECONNABORTED' ? 'PROVIDER_TIMEOUT' : 'NETWORK_ERROR');
    error.status = err.response?.status;
    error.response = err.response;
    throw error;
  }
}

export function buildFinalizePayload({ receipt = {}, people = [], assignments = {} } = {}) {
  const currency = receipt.currency || 'USD';
  const restaurantName = receipt.restaurantName || '';
  const taxMinor = Number.isSafeInteger(receipt.taxMinor) ? receipt.taxMinor : 0;
  const tipMinor = Number.isSafeInteger(receipt.tipMinor) ? receipt.tipMinor : 0;

  const validPeopleMap = new Map();
  people.forEach((p) => {
    if (p && typeof p.id === 'string' && p.id.trim() !== '') {
      validPeopleMap.set(p.id, {
        id: p.id,
        name: typeof p.name === 'string' ? p.name.trim() : '',
      });
    }
  });

  const sanitizedPeople = [...validPeopleMap.values()];

  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const sanitizedItems = items.map((item) => {
    const rawAssigned = assignments[item.id] !== undefined
      ? assignments[item.id]
      : (Array.isArray(item.assignedTo) ? item.assignedTo : []);

    const assignedTo = [];
    if (Array.isArray(rawAssigned)) {
      for (const personId of rawAssigned) {
        if (typeof personId === 'string' && validPeopleMap.has(personId) && !assignedTo.includes(personId)) {
          assignedTo.push(personId);
        }
      }
    }

    const quantity = Number.isSafeInteger(item.quantity) && item.quantity >= 1 ? item.quantity : 1;
    const priceMinor = Number.isSafeInteger(item.priceMinor) ? item.priceMinor : 0;

    return {
      id: item.id,
      name: typeof item.name === 'string' ? item.name.trim() : '',
      quantity,
      priceMinor,
      assignedTo,
    };
  });

  const payload = {
    restaurantName,
    currency,
    people: sanitizedPeople,
    items: sanitizedItems,
    taxMinor,
    tipMinor,
  };

  if (Number.isSafeInteger(receipt.printedTotalMinor)) {
    const itemsSubtotal = sanitizedItems.reduce((sum, item) => sum + item.priceMinor, 0);
    const candidateExclusive = itemsSubtotal + taxMinor + tipMinor;
    const candidateInclusive = itemsSubtotal + tipMinor;
    if (receipt.printedTotalMinor === candidateExclusive || receipt.printedTotalMinor === candidateInclusive) {
      payload.printedTotalMinor = receipt.printedTotalMinor;
    }
  }

  if (receipt.taxInclusive !== undefined) {
    payload.taxInclusive = Boolean(receipt.taxInclusive);
  }

  if (Array.isArray(receipt.additionalCharges)) {
    payload.additionalCharges = receipt.additionalCharges;
  }

  return payload;
}

export async function finalizeBill(payload) {
  const URL = getApiUrl('/api/bills');

  try {
    const response = await axios.post(URL, payload, { timeout: 15000 });
    return response.data;
  } catch (err) {
    let message = err.message || 'Failed to finalize bill. Please try again.';
    if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
      message = 'Finalization timed out. Please check your connection and try again.';
    } else if (err.response?.data?.error) {
      message = err.response.data.error;
    } else if (err.response?.status === 429) {
      message = 'Too many requests. Please try again later.';
    } else if (err.response?.status === 503) {
      message = err.response.data?.error || 'Database is temporarily unavailable. Please try again later.';
    }
    const error = new Error(message);
    error.code = err.response?.data?.code || (err.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR');
    error.status = err.response?.status;
    error.response = err.response;
    throw error;
  }
}

export async function getBill(shareCode) {
  if (typeof shareCode !== 'string' || !shareCode.trim()) {
    const error = new Error('Bill not found');
    error.code = 'BILL_NOT_FOUND';
    error.status = 404;
    throw error;
  }
  const cleanCode = encodeURIComponent(shareCode.trim());
  const URL = getApiUrl(`/api/bills/${cleanCode}`);

  try {
    const response = await axios.get(URL, { timeout: 10000 });
    return response.data;
  } catch (err) {
    let message = err.message || 'Failed to load bill. Please try again.';
    if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
      message = 'Request timed out. Please try again.';
    } else if (err.response?.data?.error) {
      message = err.response.data.error;
    } else if (err.response?.status === 404) {
      message = 'Bill not found';
    } else if (err.response?.status === 429) {
      message = 'Too many requests. Please try again later.';
    } else if (err.response?.status === 503) {
      message = err.response.data?.error || 'Database is temporarily unavailable. Please try again later.';
    }
    const error = new Error(message);
    error.code = err.response?.data?.code || (err.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR');
    error.status = err.response?.status;
    error.response = err.response;
    throw error;
  }
}

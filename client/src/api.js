import axios from 'axios';

export async function extractReceipt(receiptFile, currency) {
  const URL = '/api/extract-receipt';

  const formData = new FormData();
  formData.append('image', receiptFile);
  formData.append('currency', currency);

  try {
    const response = await axios.post(URL, formData);
    return response.data;
  } catch (err) {
    const message =
      err.response?.data?.error ||
      err.message ||
      'Failed to scan receipt. Please try again.';
    const error = new Error(message);
    error.code = err.response?.data?.code;
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
  const URL = '/api/bills';

  try {
    const response = await axios.post(URL, payload);
    return response.data;
  } catch (err) {
    const message =
      err.response?.data?.error ||
      err.message ||
      'Failed to finalize bill. Please try again.';
    const error = new Error(message);
    error.code = err.response?.data?.code;
    error.status = err.response?.status;
    error.response = err.response;
    throw error;
  }
}

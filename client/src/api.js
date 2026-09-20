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

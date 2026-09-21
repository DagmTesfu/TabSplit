// routes/bills.js — bill finalization and public share lookup.
// POST /api/bills       validate -> recalculate -> persist -> share URL
// GET  /api/bills/:code public finalized-bill retrieval by share code
// No drafts, no PATCH (finalized bills are immutable), no auth in V1.
import express from 'express';
import {
  BillError, finalizeBill, generateShareCode, isValidShareCode,
} from '../bills.js';
import { insertBill, findBillByCode, getSupabaseClient } from '../db.js';
import { billsRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
router.use(billsRateLimiter);

// Overridable only for tests; production always uses the real Supabase db.
let dbOverride = null;
export function setBillDbForTesting(override) {
  dbOverride = override;
}

function db() {
  if (dbOverride) return dbOverride;
  const client = getSupabaseClient();
  if (!client) {
    throw Object.assign(new Error('Database is not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)'), {
      code: 'DB_NOT_CONFIGURED',
    });
  }
  return {
    insertBill: (row) => insertBill(client, row),
    findBillByCode: (code) => findBillByCode(client, code),
  };
}

// Map internal error codes to HTTP responses in the existing API error style.
function sendError(res, error) {
  const status = {
    INVALID_BILL: 400,
    INVALID_CURRENCY: 400,
    UNASSIGNED_ITEMS: 400,
    DB_NOT_CONFIGURED: 503,
    DB_UNAVAILABLE: 503,
  }[error.code] || 500;
  return res.status(status).json({ error: error.message, code: error.code || 'INTERNAL_ERROR' });
}

function toShareUrl(shareCode) {
  // The frontend route is /b/:code; base URL comes from the configured client
  // origin (deployment env), not from request headers.
  const base = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
  return `${base.replace(/\/+$/, '')}/b/${shareCode}`;
}

router.post('/bills', async (req, res) => {
  try {
    const canonicalBill = finalizeBill(req.body);
    const payload = {
      share_code: null, // set below after generation; kept explicit for clarity
      status: 'finalized',
      restaurant_name: canonicalBill.restaurantName,
      currency: canonicalBill.currency,
      bill: canonicalBill,
      items_total_minor: canonicalBill.totals.itemsTotalMinor,
      tax_minor: canonicalBill.taxMinor,
      tip_minor: canonicalBill.tipMinor,
      total_minor: canonicalBill.totals.billTotalMinor,
      assigned_total_minor: canonicalBill.totals.assignedMinor,
      unassigned_total_minor: canonicalBill.totals.unassignedMinor,
    };
    // Retry on the astronomically rare duplicate share code.
    let row;
    for (let attempt = 0; attempt < 3; attempt++) {
      payload.share_code = generateShareCode();
      const { data, error } = await db().insertBill(payload); // eslint-disable-line no-await-in-loop
      if (!error) { row = data; break; }
      if (error.code !== '23505') throw toDbError(error); // 23505 = unique violation
    }
    if (!row) throw new BillError('DB_UNAVAILABLE', 'Could not allocate a share code. Please try again.');
    res.status(201).json({ shareCode: row.share_code, shareUrl: toShareUrl(row.share_code), bill: canonicalBill });
  } catch (error) {
    sendError(res, error);
  }
});

function toDbError(error) {
  const mapped = new BillError('DB_UNAVAILABLE', 'Could not save the bill. Please try again.');
  mapped.cause = error;
  return mapped;
}

router.get('/bills/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (!isValidShareCode(code)) {
      return res.status(404).json({ error: 'Bill not found', code: 'BILL_NOT_FOUND' });
    }
    const { data, error } = await db().findBillByCode(code);
    if (error) throw toDbError(error);
    if (!data) return res.status(404).json({ error: 'Bill not found', code: 'BILL_NOT_FOUND' });
    res.set('Cache-Control', 'no-store');
    return res.json({
      shareCode: data.share_code,
      createdAt: data.created_at,
      restaurantName: data.restaurant_name,
      currency: data.currency,
      bill: data.bill,
    });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;

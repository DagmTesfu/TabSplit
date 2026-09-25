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
// Unhandled or 500 errors always receive a sanitized message without leaking internals.
function sendError(res, error) {
  const status = {
    INVALID_BILL: 400,
    INVALID_CURRENCY: 400,
    UNASSIGNED_ITEMS: 400,
    DB_NOT_CONFIGURED: 503,
    DB_UNAVAILABLE: 503,
  }[error.code];

  if (!status) {
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.', code: 'INTERNAL_ERROR' });
  }
  return res.status(status).json({ error: error.message, code: error.code });
}

function toShareUrl(shareCode) {
  // The frontend route is /b/:code; base URL comes from the configured client
  // origin (deployment env), not from request headers.
  const base = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
  return `${base.replace(/\/+$/, '')}/b/${shareCode}`;
}

router.post('/bills', async (req, res) => {
  try {
    // Temporary SAFE diagnostic logging (non-sensitive metadata only)
    const safeMetadata = {
      method: req.method,
      pathname: req.originalUrl || req.path,
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent'] ? req.headers['user-agent'].slice(0, 100) : undefined,
      bodyTopLevelKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : [],
      restaurantName: typeof req.body?.restaurantName === 'string' ? req.body.restaurantName.slice(0, 50) : null,
      currency: req.body?.currency,
      itemCount: Array.isArray(req.body?.items) ? req.body.items.length : 0,
      peopleCount: Array.isArray(req.body?.people) ? req.body.people.length : 0,
      assignmentCount: Array.isArray(req.body?.items)
        ? req.body.items.reduce((sum, item) => sum + (Array.isArray(item?.assignedTo) ? item.assignedTo.length : 0), 0)
        : 0,
      itemIds: Array.isArray(req.body?.items) ? req.body.items.map((it) => it?.id) : [],
      personIds: Array.isArray(req.body?.people) ? req.body.people.map((p) => p?.id) : [],
      numericAmounts: {
        taxMinor: req.body?.taxMinor,
        tipMinor: req.body?.tipMinor,
        printedTotalMinor: req.body?.printedTotalMinor,
        additionalChargesCount: Array.isArray(req.body?.additionalCharges) ? req.body.additionalCharges.length : 0,
      },
    };
    console.log('[DIAGNOSTIC] POST /api/bills metadata:', JSON.stringify(safeMetadata));

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
      if (error.code !== '23505') {
        console.error('[DIAGNOSTIC] Supabase insert error:', {
          code: error.code || null,
          message: typeof error.message === 'string' ? error.message : String(error),
          details: error.details || null,
          hint: error.hint || null,
        });
        throw toDbError(error); // 23505 = unique violation
      }
    }
    if (!row) {
      console.error('[DIAGNOSTIC] Failed to allocate share code after 3 attempts');
      throw new BillError('DB_UNAVAILABLE', 'Could not allocate a share code. Please try again.');
    }
    res.status(201).json({ shareCode: row.share_code, shareUrl: toShareUrl(row.share_code), bill: canonicalBill });
  } catch (error) {
    if (error.code === 'DB_NOT_CONFIGURED' || error.code === 'DB_UNAVAILABLE') {
      console.error('[DIAGNOSTIC] Finalize failed with DB error:', {
        code: error.code,
        message: error.message,
        cause: error.cause ? {
          code: error.cause.code || null,
          message: typeof error.cause.message === 'string' ? error.cause.message : String(error.cause),
          details: error.cause.details || null,
          hint: error.cause.hint || null,
        } : undefined,
      });
    }
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

# TabSplit

TabSplit is a receipt scanner and item-level bill splitting web application.

## Architecture

- **Frontend**: React 18 / Vite SPA (Deployed on **Vercel**)
- **Backend**: Node.js / Express API (Deployed on **Render**)
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Vision AI**: OpenRouter Chat Completions API (`openrouter/free`)

---

## Local Development

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
# Fill in OPENROUTER_API_KEY, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in .env
npm run dev
```

The Express API starts at `http://localhost:4000`.

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

The Vite dev server starts at `http://localhost:5173`. In development, requests to `/api/*` are automatically proxied to `http://localhost:4000`.

---

## Production Deployment Guide

### 1. Database (Supabase)

1. Create a new project in [Supabase](https://supabase.com).
2. Open the **SQL Editor** and run the contents of [`server/supabase/schema.sql`](server/supabase/schema.sql).
3. Confirm `bills` table is created with Row Level Security (RLS) enabled and zero public policies.
4. Retrieve your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from **Project Settings -> API** (used only on the backend).

---

### 2. Backend (Render)

1. Create a new **Web Service** on [Render](https://render.com) connected to this repository.
2. Configure settings:
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Configure **Environment Variables**:
   - `OPENROUTER_API_KEY`: Your OpenRouter API key.
   - `SUPABASE_URL`: `https://<project-ref>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: Secret service-role key (server-side only).
   - `PUBLIC_APP_URL`: Your production frontend URL (e.g. `https://tabsplit.vercel.app`).
   - `CLIENT_ORIGIN`: Your production frontend origin (e.g. `https://tabsplit.vercel.app`).
   - `TRUST_PROXY`: `1` (enables Express to trust Render's single-hop reverse proxy for accurate rate-limiting).
4. Verify backend startup by requesting `GET https://<your-render-service>.onrender.com/api/health` (returns `{"ok": true}`).

---

### 3. Frontend (Vercel)

1. Create a new project on [Vercel](https://vercel.com) importing this repository.
2. Configure settings:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Configure **Environment Variables**:
   - `VITE_API_BASE_URL`: Your backend API URL (e.g. `https://<your-render-service>.onrender.com`).
4. SPA routing is pre-configured via [`client/vercel.json`](client/vercel.json) rewrite rules so deep links like `/b/:shareCode` load correctly.

---

## Production Deployment Smoke-Test Checklist

Before releasing to users, verify the following steps against the deployed environments:

- [ ] **1. Backend Health**: `GET /api/health` on Render returns HTTP 200 `{"ok": true}`.
- [ ] **2. Frontend Initial Load**: Open production frontend URL on Vercel; landing page renders cleanly.
- [ ] **3. Scan Receipt**: Upload a photo on `/scan` in ETB or USD.
- [ ] **4. AI Extraction**: Extraction completes and redirects to `/review` with parsed items.
- [ ] **5. Review & Edit**: Edit item names/prices, add/remove items; totals reflect updates.
- [ ] **6. Add People**: Navigate to `/people`; add participants (names persist across pages).
- [ ] **7. Assign Items**: Navigate to `/assign`; assign items to participants.
- [ ] **8. Summary Calculation**: Verify `/summary` displays exact pro-rata tax/tip allocations.
- [ ] **9. Finalize Bill**: Click Finalize; bill is persisted and redirects to `/finalized` with share link.
- [ ] **10. Direct Shared Link**: Open `https://<frontend-domain>/b/<shareCode>` directly in an incognito window.
- [ ] **11. Multi-Device Access**: Open shared bill URL on mobile; confirm responsive layout.
- [ ] **12. Copy Link**: Tap "Copy Link"; verify share URL is copied to clipboard.
- [ ] **13. Invalid Share Code**: Open `/b/invalidcode123`; verify user-friendly "Bill Not Found" page.
- [ ] **14. CORS Protection**: Verify cross-origin requests from unapproved domains are rejected.
- [ ] **15. Secret Shielding**: Verify no API keys or service role secrets are present in browser DevTools network/bundle inspection.

---

## Testing & Verification

```bash
# Server tests (unit, route, rate limiting, security audit)
cd server
npm test

# Client tests (unit, edge cases, error handling)
cd client
npm test

# Production client build
npm run build
```

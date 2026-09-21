-- TabSplit V1 schema: finalized bills only (no drafts, no auth).
-- Paste into Supabase SQL Editor and run once.

create table bills (
  id             uuid primary key default gen_random_uuid(),
  share_code     text not null unique,
  status         text not null default 'finalized' check (status in ('finalized')),
  restaurant_name text not null default '',
  currency       text not null check (currency in ('ETB', 'USD')),
  -- Canonical bill payload written once by the server after recalculation.
  -- Items, people and assignments are consumed as a whole document.
  bill           jsonb not null,
  -- Server-computed totals in currency minor units (check constraints keep
  -- the invariants true even if application code regresses).
  items_total_minor      bigint not null check (items_total_minor >= 0),
  tax_minor              bigint not null check (tax_minor >= 0),
  tip_minor              bigint not null check (tip_minor >= 0),
  total_minor            bigint not null check (total_minor >= 0),
  assigned_total_minor   bigint not null check (assigned_total_minor >= 0),
  unassigned_total_minor bigint not null check (unassigned_total_minor >= 0),
  created_at     timestamptz not null default now(),
  check (assigned_total_minor + unassigned_total_minor = total_minor)
);

create index bills_created_at_idx on bills (created_at desc);

-- Defense in depth for the no-auth V1: RLS is enabled with no anon policies,
-- so only the service-role key (server-side) can read or write rows.
alter table bills enable row level security;

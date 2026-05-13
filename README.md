# Budget Bestie

Budget Bestie is a personal finance analytics app built as a portfolio-grade Data Analyst project.

It converts messy bank statements into structured data, then produces decision-ready insights:
- per-user accounts with isolated data
- import from paste/CSV/XLSX (RBC/AMEX and similar formats)
- duplicate detection (exact + likely duplicates)
- category learning and editable transactions
- interactive analytics, budgeting, and savings planning
- export pack (CSV/XLSX/JSON/TXT)

## Analyst Portfolio Positioning

This project demonstrates end-to-end analyst skills:
- data ingestion and cleaning
- sign normalization and quality controls
- dimensional analytics model design
- KPI definition and variance analysis
- dashboard storytelling and action-oriented recommendations

Use these artifacts in interviews:
- SQL model: `analytics/schema.sql`
- analyst query pack: `analytics/queries.sql`
- KPI definitions: `docs/kpi-dictionary.md`
- case-study narrative: `docs/case-study-template.md`

## Tech Stack

- React + TypeScript
- Recharts for interactive analytics visuals
- PapaParse + SheetJS for statement ingestion
- Optional cloud sync/auth via Supabase

## Project Structure

- `src/App.tsx`: main application logic and UI
- `src/supabase.ts`: optional cloud auth/state integration
- `analytics/schema.sql`: star schema for BI workflows
- `analytics/queries.sql`: reusable SQL analysis queries
- `docs/kpi-dictionary.md`: metric definitions and formulas
- `docs/case-study-template.md`: portfolio case-study format

## Local Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Free Deploy (Cloudflare Pages, Static-Only)

This app can run as a static website with local browser storage only.
That is the lowest-cost mode.

1. Local-only free-safe mode is forced by deploy script:

```bash
npm run deploy:pages:free -- budget-bestie
```

2. Free cross-browser sync mode (still no paid API keys) uses a Cloudflare state worker:

```bash
npm run deploy:pages:state-sync -- budget-bestie-app
```

2. Login once to Cloudflare from your terminal:

```bash
npx wrangler login
```

Notes:
- You can keep editing after publish: change code, push/update, redeploy.
- If you ever want to stop public use, delete or disable the Pages project from Cloudflare dashboard.
- Fast stop command from terminal:

```bash
npm run stop:pages:public -- budget-bestie
```

- Your local private copy still works with `npm run dev`.

## Cloud Account Mode (Supabase, cross-device)

Use this only when you want real account sync across devices.

1. Copy `.env.cloud.example` to `.env.cloud` and fill values:

```bash
cp .env.cloud.example .env.cloud
```

2. Deploy cloud mode:

```bash
npm run deploy:pages:cloud -- budget-bestie .env.cloud
```

3. If you want zero-cost local-only mode again:

```bash
npm run deploy:pages:free -- budget-bestie
```

## Optional Supabase Cloud Mode

Create `.env`:

```bash
VITE_ENABLE_CLOUD_SYNC=true
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# Optional: state API endpoint. Leave empty for no-server mode.
VITE_STATE_ENDPOINT=
```

Run this SQL in Supabase:

```sql
create table if not exists public.user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_states enable row level security;

create policy "user can read own state"
on public.user_states
for select
using (auth.uid() = user_id);

create policy "user can insert own state"
on public.user_states
for insert
with check (auth.uid() = user_id);

create policy "user can update own state"
on public.user_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## CI

GitHub Actions workflow is included to run:
- lint
- build
- tests

on push and pull request.

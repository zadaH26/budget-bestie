-- Budget Bestie Analytics Schema
-- Star schema for BI/analyst workflows

create table if not exists dim_account (
  account_key text primary key,
  account_name text not null,
  created_at_utc text,
  is_active integer not null default 1
);

create table if not exists dim_category (
  category_key text primary key,
  category_name text not null,
  category_group text,
  category_color text,
  is_income integer not null default 0,
  is_transfer integer not null default 0,
  is_credit_card_payment integer not null default 0
);

create table if not exists dim_merchant (
  merchant_key text primary key,
  merchant_name text not null,
  merchant_normalized text not null,
  first_seen_date text,
  last_seen_date text
);

create table if not exists dim_date (
  date_key text primary key, -- YYYY-MM-DD
  year integer not null,
  quarter integer not null,
  month integer not null,
  month_key text not null, -- YYYY-MM
  month_name text not null,
  week_of_year integer not null,
  day_of_week integer not null, -- 1=Mon .. 7=Sun
  day_name text not null,
  is_weekend integer not null
);

create table if not exists fact_transactions (
  transaction_key text primary key,
  account_key text not null references dim_account(account_key),
  category_key text not null references dim_category(category_key),
  merchant_key text references dim_merchant(merchant_key),
  date_key text not null references dim_date(date_key),
  source_system text,
  notes text,
  amount_signed numeric not null,
  amount_abs numeric not null,
  direction text not null check (direction in ('expense', 'income')),
  is_recurring integer not null default 0,
  recurrence_frequency text,
  created_at_utc text not null,
  quality_flags text -- comma-separated flags (duplicate_candidate,sign_anomaly,missing_merchant)
);

create index if not exists idx_fact_transactions_date on fact_transactions(date_key);
create index if not exists idx_fact_transactions_category on fact_transactions(category_key);
create index if not exists idx_fact_transactions_merchant on fact_transactions(merchant_key);
create index if not exists idx_fact_transactions_account on fact_transactions(account_key);

create view if not exists v_monthly_spend as
select
  d.month_key,
  sum(case when f.direction = 'expense' then f.amount_abs else 0 end) as total_spend,
  sum(case when f.direction = 'income' then f.amount_signed else 0 end) as total_income,
  sum(f.amount_signed) as net_cashflow
from fact_transactions f
join dim_date d on d.date_key = f.date_key
group by d.month_key;

create view if not exists v_category_monthly_actual as
select
  d.month_key,
  c.category_key,
  c.category_name,
  sum(case when f.direction = 'expense' then f.amount_abs else 0 end) as spend
from fact_transactions f
join dim_date d on d.date_key = f.date_key
join dim_category c on c.category_key = f.category_key
group by d.month_key, c.category_key, c.category_name;

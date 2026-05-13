-- Analyst query pack for Budget Bestie

-- 1) Monthly KPI trend
select
  d.month_key,
  sum(case when f.direction = 'expense' then f.amount_abs else 0 end) as spend,
  sum(case when f.direction = 'income' then f.amount_signed else 0 end) as income,
  sum(f.amount_signed) as net_cashflow
from fact_transactions f
join dim_date d on d.date_key = f.date_key
group by d.month_key
order by d.month_key;

-- 2) Month-over-month spend change
with monthly as (
  select
    d.month_key,
    sum(case when f.direction = 'expense' then f.amount_abs else 0 end) as spend
  from fact_transactions f
  join dim_date d on d.date_key = f.date_key
  group by d.month_key
)
select
  month_key,
  spend,
  lag(spend) over(order by month_key) as prior_month_spend,
  spend - lag(spend) over(order by month_key) as abs_change,
  case
    when lag(spend) over(order by month_key) is null or lag(spend) over(order by month_key) = 0 then null
    else ((spend - lag(spend) over(order by month_key)) / lag(spend) over(order by month_key)) * 100
  end as pct_change
from monthly
order by month_key;

-- 3) Category mix for a selected month
-- replace '2026-03' with parameter
select
  c.category_name,
  sum(case when f.direction = 'expense' then f.amount_abs else 0 end) as spend,
  sum(case when f.direction = 'expense' then f.amount_abs else 0 end)
    / nullif(sum(sum(case when f.direction = 'expense' then f.amount_abs else 0 end)) over(), 0) as share_of_spend
from fact_transactions f
join dim_date d on d.date_key = f.date_key
join dim_category c on c.category_key = f.category_key
where d.month_key = '2026-03'
group by c.category_name
order by spend desc;

-- 4) Top merchants by spend
select
  m.merchant_name,
  sum(case when f.direction = 'expense' then f.amount_abs else 0 end) as spend
from fact_transactions f
join dim_merchant m on m.merchant_key = f.merchant_key
group by m.merchant_name
order by spend desc
limit 20;

-- 5) Weekend vs weekday spend pattern
select
  case when d.is_weekend = 1 then 'weekend' else 'weekday' end as day_type,
  sum(case when f.direction = 'expense' then f.amount_abs else 0 end) as spend,
  count(*) as txn_count
from fact_transactions f
join dim_date d on d.date_key = f.date_key
group by day_type
order by day_type;

-- 6) Merchant concentration (Top 5 share)
with merchant_spend as (
  select
    m.merchant_name,
    sum(case when f.direction = 'expense' then f.amount_abs else 0 end) as spend
  from fact_transactions f
  join dim_merchant m on m.merchant_key = f.merchant_key
  group by m.merchant_name
), ranked as (
  select
    merchant_name,
    spend,
    row_number() over(order by spend desc) as rn
  from merchant_spend
)
select
  sum(case when rn <= 5 then spend else 0 end) as top5_spend,
  sum(spend) as total_spend,
  sum(case when rn <= 5 then spend else 0 end) / nullif(sum(spend), 0) as top5_share
from ranked;

-- 7) Budget variance by category/month
-- assumes table fact_budget_targets(month_key, category_key, target_amount)
select
  b.month_key,
  c.category_name,
  b.target_amount,
  coalesce(a.actual_spend, 0) as actual_spend,
  coalesce(a.actual_spend, 0) - b.target_amount as variance_amount,
  case
    when b.target_amount = 0 then null
    else ((coalesce(a.actual_spend, 0) - b.target_amount) / b.target_amount) * 100
  end as variance_pct
from fact_budget_targets b
join dim_category c on c.category_key = b.category_key
left join (
  select
    d.month_key,
    f.category_key,
    sum(case when f.direction = 'expense' then f.amount_abs else 0 end) as actual_spend
  from fact_transactions f
  join dim_date d on d.date_key = f.date_key
  group by d.month_key, f.category_key
) a on a.month_key = b.month_key and a.category_key = b.category_key
order by b.month_key, c.category_name;

-- 8) Data quality summary
with base as (
  select
    count(*) as total_rows,
    sum(case when merchant_key is null then 1 else 0 end) as missing_merchant_rows,
    sum(case when quality_flags like '%duplicate_candidate%' then 1 else 0 end) as duplicate_candidates,
    sum(case when quality_flags like '%sign_anomaly%' then 1 else 0 end) as sign_anomalies
  from fact_transactions
)
select
  total_rows,
  missing_merchant_rows,
  duplicate_candidates,
  sign_anomalies,
  100.0
    - ((missing_merchant_rows + duplicate_candidates + sign_anomalies) * 100.0 / nullif(total_rows, 0)) as quality_score
from base;

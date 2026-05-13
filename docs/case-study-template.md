# Budget Bestie Case Study (Portfolio)

## 1) Business Problem
People can track transactions, but struggle to convert raw bank exports into decisions. The project solves:
- inconsistent statement formats
- duplicate imports
- weak category consistency
- no action-oriented savings planning

## 2) Dataset and Inputs
- Source systems: RBC and AMEX exports (CSV/XLSX/paste)
- Grain: one transaction per row
- Fields: date, amount, notes, source, category, recurrence metadata

## 3) Data Pipeline
- Parse raw statements
- Normalize dates, merchant text, and amount signs
- Remove exact and near duplicates
- Apply learned category mapping rules
- Persist per-user account state

## 4) Data Model
- Star schema: `fact_transactions` + dimensions (`dim_date`, `dim_category`, `dim_merchant`, `dim_account`)
- Query pack in `/analytics/queries.sql`

## 5) BI and Reporting
- Cross-filter charts (category, month, merchant)
- Monthly and weekly trend analysis
- Budget vs actual tracking
- Interactive savings scenario planner

## 6) Data Quality and Validation
- duplicate candidate detection
- sign anomaly checks
- missing field checks
- quality score

## 7) Key Insights Example
- Top 3 categories represent most spending concentration
- Weekend spending materially differs from weekday baseline
- Merchant concentration identifies high-impact optimization targets

## 8) Recommendations
- category-level cut plan by impact and feasibility
- monthly savings targets and weekly breakdown
- confidence-aware scenario planning (base/conservative/aggressive)

## 9) Impact
- Reduced manual clean-up effort
- Improved consistency of financial reporting
- Converted transaction history into a repeatable decision workflow

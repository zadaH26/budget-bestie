# KPI Dictionary

## Core Finance KPIs

- `Total Spending`
  - Definition: Sum of absolute value of all expense transactions (`amount < 0`) in the active filter.
  - Formula: `SUM(ABS(amount)) WHERE amount < 0`

- `Total Income (Pay/Deposits)`
  - Definition: Sum of positive transactions tagged as `Income` category.
  - Formula: `SUM(amount) WHERE amount > 0 AND category = Income`

- `Credits & Refunds`
  - Definition: Sum of positive transactions not tagged as `Income` (refunds, credits, reversals, installment credits).
  - Formula: `SUM(amount) WHERE amount > 0 AND category != Income`

- `Net Cashflow`
  - Definition: Net movement after spending and inflows.
  - Formula: `Total Income + Credits & Refunds - Total Spending`

- `Savings Goal Gap`
  - Definition: Remaining amount needed to hit selected savings target.
  - Formula: `MAX(0, SavingsTarget - ProjectedSave)`

## Planning KPIs

- `Projected Save`
  - Definition: Sum of category-level projected cut savings from planner.
  - Formula: `SUM(category_baseline * cut_pct)`

- `Spend After Cuts`
  - Definition: Baseline spend after applying planner cuts.
  - Formula: `BaselineSpend - ProjectedSave`

- `Required Monthly Save`
  - Definition: Required monthly savings to hit goal within selected horizon.
  - Formula: `ReachableGoal / HorizonMonths`

- `Required Cut %`
  - Definition: Monthly save needed as a percentage of average monthly spend.
  - Formula: `RequiredMonthlySave / AvgMonthlySpend`

## Data Quality KPIs

- `Duplicate Candidates`
  - Definition: Rows likely duplicated by same date + same amount + same/similar merchant name.

- `Sign Anomalies`
  - Definition: Direction inconsistent with known cues (`sent`, `received`, etc).

- `Missing Field Count`
  - Definition: Transactions missing required values (date, notes, amount, category).

- `Data Quality Score`
  - Definition: Composite quality score from 0-100.
  - Formula: `100 - weighted_error_rate`

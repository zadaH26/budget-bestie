# Budget Bestie

Budget Bestie is a personal-finance web app for tracking transactions, budgets, spending patterns, and savings goals.

Live app: [https://budget-bestie-app.pages.dev/](https://budget-bestie-app.pages.dev/)

## What It Does

Budget Bestie helps users understand where their money is going by turning transactions into clean, visual reports.

Core features:

- Create a personal budget workspace in the browser
- Add, edit, categorize, and delete transactions
- Import transaction data from CSV/XLSX-style bank statements
- Detect duplicate transactions and clean messy imported data
- Build budgets by category
- View interactive reports with charts, filters, and spending summaries
- Track savings goals and forecast savings progress
- Customize the app theme, colors, fonts, and branding
- Export data as CSV/XLSX for analysis

## Why I Built It

I built this project as a portfolio-grade personal finance dashboard. The goal was to combine product design, frontend engineering, and data analysis in one deployed application.

This project demonstrates:

- React component architecture
- TypeScript state management
- Data cleaning and transaction normalization
- Interactive data visualization
- Responsive UI design
- Static deployment with Cloudflare Pages
- Privacy-aware local storage

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS / custom CSS styling
- Recharts
- PapaParse
- SheetJS / XLSX
- Cloudflare Pages
- Cloudflare Workers / Durable Objects
- Optional Supabase cloud sync support

## Current Deployment Mode

The public deployed app currently uses account-scoped Cloudflare sync.

That means:

- A visitor can create a free account with a username and password
- The same username/password can load that account from another browser or device
- Account data is stored in a Cloudflare Worker Durable Object
- The app still keeps a local browser copy for speed and resilience
- Private user data is not committed to GitHub

Supabase cloud sync support also exists in the codebase, but the current public deployment uses the Cloudflare account-sync worker.

## Project Structure

```text
src/
  app/              App shell, shared context, layout, app-level components
  components/       Reusable UI components
  pages/            Page-level screens such as dashboard, expenses, reports, budgets
  pages/reports/    Modular reports and analytics components
  styles/           Shared styling
  types/            TypeScript domain types
  utils/            Data parsing, persistence, account, and transaction helpers

analytics/          SQL schema and analyst query examples
docs/               KPI dictionary and project case-study notes
scripts/            Deployment and maintenance scripts
cloudflare/         Cloudflare worker/state-sync files
```

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the production version:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

Run tests:

```bash
npm run test
```

## Deployment

The app is deployed with Cloudflare Pages.

Production build:

```bash
npm run build
```

Deploy:

```bash
npx wrangler pages deploy dist --project-name budget-bestie-app --branch main --commit-dirty=true
```

## Privacy Notes

Private data files and local backups should not be committed to GitHub.

Ignored private files include:

- `.budget-bestie-state.json`
- `.budget-bestie-state*.json`
- `.local-backups/`
- `.env`
- `.env.cloud`

The public repository should contain source code only, not personal transaction data or secret API keys.

## Resume Summary

Built and deployed Budget Bestie, a React and TypeScript personal-finance dashboard with transaction management, budgeting tools, interactive reports, data import/export, savings forecasting, customizable themes, and Cloudflare Pages deployment.

## Future Improvements

- Connect a valid Supabase project for cross-device account sync
- Add a public sample/demo dataset that does not contain private data
- Add more automated tests for transaction parsing and report calculations
- Add screenshots/GIFs to the README for recruiters
- Split more report analytics into smaller focused components

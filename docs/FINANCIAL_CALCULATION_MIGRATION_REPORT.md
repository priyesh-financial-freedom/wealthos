# Financial Calculation Migration Report

Status: Audit complete. No production logic refactor performed in this step.

## 1) Policy Baseline

Target architecture rule:

- Only the Financial Planning Engine performs financial calculations.
- UI, Dashboard, Decision Center, Reports, and Health Score layers must be presentation and orchestration only.

## 2) Audit Method

- Scope: src/services, src/app, src/components.
- Techniques: code search for reduction/aggregation, ratio/percentage, delta, growth/return, XIRR/CAGR, and net-worth math.
- Output model: file-level hotspots classified by financial domain and migration destination.

## 3) Confirmed Hotspot Inventory

Legend:

- Status ALLOWED: engine-domain calculations that can remain in Planning Engine internals.
- Status VIOLATION: calculations currently outside the allowed engine boundary.

| ID | File | Layer | Financial Calculations Found | Domain Class | Status | Target Destination | Priority |
|---|---|---|---|---|---|---|---|
| 1 | src/services/projection/steps/IncomeStep.ts | Projection Engine | salary growth, bonus timing, income aggregation | Income, Cash Flow | ALLOWED | Keep in planning/projections engine step | P0 |
| 2 | src/services/projection/steps/ExpenseStep.ts | Projection Engine | inflation-adjusted living expenses | Expense, Cash Flow | ALLOWED | Keep in planning/projections engine step | P0 |
| 3 | src/services/projection/steps/LoanStep.ts | Projection Engine | EMI growth, weighted interest rate, principal/interest split | Loan, Cash Flow | ALLOWED | Keep in planning/projections engine step | P0 |
| 4 | src/services/projection/steps/TaxStep.ts | Projection Engine | effective tax on gross income | Tax, Cash Flow | ALLOWED | Keep in planning/projections engine step | P0 |
| 5 | src/services/projection/steps/InvestmentStep.ts | Projection Engine | contributions, returns, corpus growth, appreciation | Investment, Retirement, Cash Flow | ALLOWED | Keep in planning/projections engine step | P0 |
| 6 | src/services/projection/steps/GoalFundingStep.ts | Projection Engine | emergency reserve target, funding allocation | Goal, Cash Flow | ALLOWED | Keep in planning/projections engine step | P0 |
| 7 | src/services/projection/steps/NetWorthStep.ts | Projection Engine | closing net worth, liquidity ratio | Cash Flow | ALLOWED | Keep in planning/projections engine step | P0 |
| 8 | src/services/projection/EventEngine.ts | Projection Engine | balance deltas, contributions, growth deltas | Cash Flow | ALLOWED | Keep in planning/projections engine core | P0 |
| 9 | src/services/projection/ContributionProcessor.ts | Projection Engine | assumption-based contribution events | Income, Investment, Retirement, Cash Flow | ALLOWED | Keep in planning/projections engine processor | P0 |
| 10 | src/services/projection/GrowthProcessor.ts | Projection Engine | annual-to-monthly conversion, growth effects by sleeve | Investment, Retirement, Cash Flow | ALLOWED | Keep in planning/projections engine processor | P0 |
| 11 | src/services/simulation/SimulationRunner.ts | Simulation Engine | opening state derivation, assumptions normalization, summary outputs | Cash Flow, Retirement, Loan | ALLOWED | Keep in planning/simulation engine | P0 |
| 12 | src/services/projection/MonthlyReviewService.ts | Projection Review | KPI variance, MoM and projection deltas | Cash Flow, Investment, Loan | ALLOWED | Keep in planning/review engine module | P1 |
| 13 | src/services/monthEndClose/MonthEndCloseService.ts | Month-End Engine | mapping holdings to buckets, variance values, KPI composition | Investment, Loan, Cash Flow | ALLOWED | Keep in planning/month-end engine module | P1 |
| 14 | src/services/dashboard/ExecutiveDashboardService.ts | Dashboard Service | share %, on-track ratio, average monthly delta, derived KPIs | Goal, Retirement, Cash Flow | VIOLATION | planning/reports module (precomputed executive view model) | P0 |
| 15 | src/services/decision/DecisionRules.ts | Decision Center Service | debt ratio thresholds, goal progress thresholds, cash-flow pressure rules | Loan, Goal, Cash Flow, Retirement | VIOLATION | planning/decision module consuming engine metrics only | P0 |
| 16 | src/services/health/HealthScoreService.ts | Health Score Service | weighted score model, ratio scoring, penalties, trend math | Loan, Retirement, Goal, Investment, Cash Flow | VIOLATION | planning/reports or planning/health module backed by engine metrics | P0 |
| 17 | src/components/dashboard/ExecutiveDashboard.tsx | Dashboard UI | FI progress score blend, local percentage clamping/math | Goal, Retirement, Cash Flow | VIOLATION | consume precomputed dashboard view model fields only | P0 |
| 18 | src/app/planning/decision-center/page.tsx | Decision Center UI | confidence percentage, local ranking/sorting weighting | Cash Flow, Goal | VIOLATION | consume pre-ranked recommendations from planning/decision | P1 |
| 19 | src/app/history/page.tsx | History UI | delta %, debt ratio comparisons, trend differentials | Loan, Cash Flow | VIOLATION | planning/reports history read model | P1 |
| 20 | src/app/projection-viewer/page.tsx | Planning UI | net-worth/asset/liability deltas for summary cards | Cash Flow | VIOLATION | planning/projections view model output | P1 |
| 21 | src/app/liabilities/page.tsx | Liabilities UI | totals, weighted rates/EMI summaries, payoff indicators | Loan, Cash Flow | VIOLATION | planning/reports liabilities summary model | P1 |
| 22 | src/components/liabilities/LiabilitySummary.tsx | Liabilities UI Component | aggregated totals and ratios | Loan | VIOLATION | move aggregation to planning read model | P1 |
| 23 | src/app/investments/mutual-funds/page.tsx | Investments UI | invested/current/gain aggregates | Investment | VIOLATION | planning/reports investment summary model | P1 |
| 24 | src/app/investments/stocks/page.tsx | Investments UI | totals and gain/loss aggregates | Investment | VIOLATION | planning/reports investment summary model | P1 |
| 25 | src/app/investments/bonds/page.tsx | Investments UI | totals and coupon/yield derived summaries | Investment | VIOLATION | planning/reports investment summary model | P1 |
| 26 | src/app/investments/fixed-deposits/page.tsx | Investments UI | principal/current/gain aggregates | Investment | VIOLATION | planning/reports investment summary model | P1 |
| 27 | src/app/investments/gold/page.tsx | Investments UI | cost/current/gain aggregates | Investment | VIOLATION | planning/reports investment summary model | P1 |
| 28 | src/app/investments/esops/page.tsx | Investments UI | vested/share/value totals | Investment | VIOLATION | planning/reports investment summary model | P1 |
| 29 | src/app/investments/startup-investments/page.tsx | Investments UI | valuation totals and gain aggregates | Investment | VIOLATION | planning/reports investment summary model | P1 |
| 30 | src/app/investments/alternative-investments/page.tsx | Investments UI | invested/current/gain aggregates | Investment | VIOLATION | planning/reports investment summary model | P1 |
| 31 | src/components/investments/mutualFunds/MutualFundHoldingsTable.tsx | Investments UI Component | gain percent calculation per row | Investment | VIOLATION | backend/view-model computed percentage | P2 |
| 32 | src/components/investments/stocks/StockHoldingsTable.tsx | Investments UI Component | gain percent calculation per row | Investment | VIOLATION | backend/view-model computed percentage | P2 |
| 33 | src/components/investments/mutualFunds/MutualFundDetailsDialog.tsx | Investments UI Component | gain percentage in details panel | Investment | VIOLATION | backend/view-model computed percentage | P2 |
| 34 | src/components/accountEngine/UniversalMonthlySnapshotForm.tsx | Universal Account UI Component | contribution - withdrawal cash-flow delta | Cash Flow | VIOLATION | planning/accountEngine calculations endpoint | P2 |
| 35 | src/services/finance.ts | Legacy Service Layer | totals, allocations, debt/cash ratios, trend and scoring formulas | Cash Flow, Loan, Investment | VIOLATION | decompose into planning/openingBalance + planning/reports calculators | P0 |
| 36 | src/services/balanceSheet.ts | Legacy Service Layer | category totals, net worth, debt/cash/liquidity/investment/retirement ratios | Cash Flow, Loan, Retirement, Investment | VIOLATION | planning/openingBalance + planning/reports balance-sheet model | P0 |
| 37 | src/services/investments.ts | Legacy Service Layer | gain/loss, allocation grouping, category totals, xirr/cagr fields | Investment | VIOLATION | planning/reports investments model; persist only atomic facts in service | P1 |
| 38 | src/services/assets.ts | Legacy Service Layer | per-type totals, largest asset, cash-like aggregates | Investment, Cash Flow | VIOLATION | planning/openingBalance ingestion + planning/reports model | P1 |
| 39 | src/services/liabilities.ts | Legacy Service Layer | liability bucket totals and largest liability | Loan | VIOLATION | planning/openingBalance ingestion + planning/reports model | P1 |
| 40 | src/services/retirement.ts | Legacy Service Layer | retirement total assets and account-level aggregates | Retirement | VIOLATION | planning/reports retirement model | P1 |
| 41 | src/services/fixedDeposits.ts | Legacy Service Layer | principal/current totals | Investment | VIOLATION | planning/reports investments model | P1 |
| 42 | src/services/realEstateProperties.ts | Legacy Service Layer | purchase/current value totals | Investment | VIOLATION | planning/reports assets model | P1 |
| 43 | src/services/bankAccounts.ts | Legacy Service Layer | balance normalizations and account-level aggregation utilities | Cash Flow | VIOLATION | planning/reports cash model | P1 |
| 44 | src/services/monthlySnapshots.ts | Legacy Snapshot Layer | net-worth and monthly financial deltas | Cash Flow | VIOLATION | planning/reports snapshot read model | P1 |
| 45 | src/services/universalAccounts.ts | Universal Account Service | aggregated balances, deltas, allocation math | Investment, Cash Flow | VIOLATION | planning/accountEngine + planning/reports modules | P1 |

## 4) Domain Classification Coverage

- Income: projection income step, contribution processor, scenario assumptions, dashboard cash-inflow summaries.
- Expense: expense step, insurance/tax/EMI outflow effects, monthly review expense-linked variances.
- Investment: investment step, growth processor, investments and asset summaries, UI gain/loss math.
- Loan: loan step, liabilities summaries, debt ratio and debt decision rules, health debt component.
- Retirement: retirement contribution/return logic, retirement score logic, retirement summary UIs.
- Goal: goal funding step, goal progress scoring, decision rules for goal acceleration.
- Tax: tax step and scenario tax overrides.
- Cash Flow: event deltas, monthly net changes, dashboard/health/decision trend evaluations.

## 5) Violation Summary

- Critical architectural violations (P0):
  - src/services/health/HealthScoreService.ts
  - src/services/decision/DecisionRules.ts
  - src/services/dashboard/ExecutiveDashboardService.ts
  - src/components/dashboard/ExecutiveDashboard.tsx
  - src/services/finance.ts
  - src/services/balanceSheet.ts

- Broad UI-layer violations (P1-P2):
  - Investment, liabilities, history, projection-viewer pages and related UI tables/dialogs are still performing local aggregates and percentages.

## 6) Proposed Migration Plan

Phase 0 (P0): Establish canonical computed outputs in planning domain

- Introduce planning/reports computation services that consume ProjectionContext and MonthlyLedger only.
- Move health scoring formulas from src/services/health/HealthScoreService.ts into planning domain calculators.
- Move decision thresholds/scoring from src/services/decision/DecisionRules.ts into planning decision module that consumes planning metrics.
- Move executive KPI math from src/services/dashboard/ExecutiveDashboardService.ts and src/components/dashboard/ExecutiveDashboard.tsx into planning/reports output model.
- Treat src/services/finance.ts and src/services/balanceSheet.ts as adapters that only map persisted facts (or retire them after callers migrate).

Phase 1 (P1): Migrate feature-page aggregates to precomputed view models

- Replace local sum/reduce/ratio logic in investments/liabilities/history/projection pages with planning/reports query outputs.
- Centralize derived fields: gainPercent, debtRatio, netWorthDelta, allocation shares, cash-flow deltas.

Phase 2 (P2): Cleanup and enforcement

- Remove remaining arithmetic from UI components (tables/dialogs/forms).
- Add lint guardrails for banned patterns in forbidden layers.
- Add contract tests asserting that forbidden layers consume computed fields only.

## 7) Risk Notes

- Regression risk is highest where formulas are duplicated across health, decision, dashboard, and UI summaries.
- Migration must preserve presentation behavior by snapshot-testing view models before and after refactor.
- Scenario and Goal legacy services still have direct dependency loading paths and should be aligned with ProjectionContext-first DI in the same migration window.

## 8) Acceptance Gate Before Refactor

Proceed with code changes only after sign-off on:

- P0 hotspot list and target destinations.
- Canonical formulas for debt ratio, liquidity coverage, health weighting, and executive FI progress.
- Ownership boundaries between planning/projections, planning/reports, and UI view-model consumers.
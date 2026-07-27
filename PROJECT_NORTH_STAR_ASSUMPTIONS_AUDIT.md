# PROJECT NORTH STAR - Projection Assumptions Hardening Audit

Date: 2026-07-27  
Mode: Read-only audit (no code changes)

## 0) Scope and Runtime Path Audited

This audit traces the active step-based projection runtime:

1. Context assembly: `ProjectionInputService.buildContext(...)`
2. Runtime pipeline: `IncomeStep -> ExpenseStep -> InsuranceStep -> LoanStep -> InvestmentStep -> TaxStep -> GoalFundingStep -> NetWorthStep`
3. Dashboard consumption path: `ExecutiveDashboardService`

Key source files audited:

- `src/services/planning/assumptions/AssumptionRegistry.ts`
- `src/services/planning/assumptions/AssumptionResolver.ts`
- `src/services/planning/assumptions/AssumptionService.ts`
- `src/services/planning/assumptions/AssumptionRepository.ts`
- `src/services/projection/ProjectionInputService.ts`
- `src/services/projection/ProjectionEngine.ts`
- `src/services/projection/steps/*.ts`
- `src/services/dashboard/ExecutiveDashboardService.ts`

## 1) ASSUMPTION INVENTORY

Notes:

1. Resolution order applies to Planning Assumptions 2.0 keys: `Entity Instance -> Entity Type -> Household -> System Default`.
2. "Current Effective Value" is user/scope dependent and resolved at runtime from DB overrides. In this offline audit, exact user values cannot be fetched. Baseline fallback shown below is the system default.
3. `currentAge` is excluded from direct assumptions editing fields and is effectively derived from family profile DOB (with fallback).

### 1A) Planning Assumptions 2.0 keys (canonical)

| Assumption Name | Default Value | Current Effective Value | Resolution Order | Database Storage | Source File | Projection Step Using It | User Editable | Actually Used by Runtime |
|---|---:|---|---|---|---|---|---|---|
| Current Age | 35 | Runtime-resolved from family profile DOB or fallback | Entity -> Type -> Household -> System Default | `planning_assumptions.current_age` (plus family profile DOB path) | `AssumptionRegistry.ts`, `ProjectionInputService.ts` | ProjectionInput + ProjectionEngine age track | Indirect (DOB UI) | Yes |
| Retirement Age | 60 | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.retirement_age` | `AssumptionRegistry.ts`, `AssumptionService.ts` | Indirect via `salaryStopYear` and salary-active check | Yes | Yes |
| Life Expectancy | 90 | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.life_expectancy` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Spouse Life Expectancy | 92 | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.spouse_life_expectancy` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Salary Growth Rate | 8% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.salary_growth_rate` | `AssumptionRegistry.ts`, `AssumptionService.ts` | IncomeStep (`salaryGrowthRate`, `annualIncrementRate`) | Yes | Yes |
| Bonus Growth Rate | 6% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.bonus_growth_rate` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Business Income Growth | 7% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.business_income_growth` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Rental Income Growth | 5% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.rental_income_growth` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Other Income Growth | 4% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.other_income_growth` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| General Inflation | 6% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.general_inflation` | `AssumptionRegistry.ts`, `AssumptionService.ts` | ExpenseStep (`generalInflationRate`) | Yes | Yes |
| Medical Inflation | 9% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.medical_inflation` | `AssumptionRegistry.ts`, `AssumptionService.ts` | Not used by active steps | Yes | No |
| Education Inflation | 10% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.education_inflation` | `AssumptionRegistry.ts`, `AssumptionService.ts` | Not used by active steps | Yes | No |
| Lifestyle Inflation | 7% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.lifestyle_inflation` | `AssumptionRegistry.ts`, `AssumptionService.ts` | Not used by active steps | Yes | No |
| Property Inflation | 5% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.property_inflation` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Luxury Inflation | 8% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.luxury_inflation` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Equity Return | 12% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.equity_return` | `AssumptionRegistry.ts`, `InvestmentStep.ts` | InvestmentStep | Yes | Yes |
| Debt Return | 7% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.debt_return` | `AssumptionRegistry.ts`, `AssumptionService.ts` | Mapped to `fixedDepositRate`; not consumed in active return math | Yes | No (active step path) |
| Gold Return | 6% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.gold_return` | `AssumptionRegistry.ts`, `InvestmentStep.ts` | InvestmentStep | Yes | Yes |
| Silver Return | 5% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.silver_return` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Real Estate Return | 8% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.real_estate_return` | `AssumptionRegistry.ts`, `AssumptionService.ts`, `InvestmentStep.ts` | InvestmentStep via mapped legacy field | Yes | Yes |
| Cash Return | 4% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.cash_return` | `AssumptionRegistry.ts`, `InvestmentStep.ts` | InvestmentStep | Yes | Yes |
| EPF Return | 8.15% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.epf_return` | `AssumptionRegistry.ts`, `InvestmentStep.ts` | InvestmentStep (retirement annual rate blend) | Yes | Yes |
| PPF Return | 7.1% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.ppf_return` | `AssumptionRegistry.ts`, `InvestmentStep.ts` | InvestmentStep (retirement annual rate blend) | Yes | Yes |
| NPS Equity Return | 11% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.nps_equity_return` | `AssumptionRegistry.ts`, `InvestmentStep.ts` | InvestmentStep (retirement annual rate blend) | Yes | Yes |
| NPS Debt Return | 7% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.nps_debt_return` | `AssumptionRegistry.ts`, `InvestmentStep.ts` | InvestmentStep (retirement annual rate blend) | Yes | Yes |
| Home Loan Interest | 8.5% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.home_loan_interest` | `AssumptionRegistry.ts`, `AssumptionService.ts`, `LoanStep.ts` | LoanStep fallback if liability rate missing | Yes | Yes (fallback path) |
| Car Loan Interest | 9.5% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.car_loan_interest` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Personal Loan Interest | 13% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.personal_loan_interest` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Loan Prepayment Strategy | HYBRID | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.loan_prepayment_strategy` | `AssumptionRegistry.ts`, `AssumptionService.ts`, `LoanStep.ts` | LoanStep (`useExtraCashForPrepayment`) | Yes | Yes |
| Income Tax Rate | 20% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.income_tax_rate` | `AssumptionRegistry.ts`, `ProjectionInputService.ts`, `TaxStep.ts` | TaxStep via tax profile | Yes | Yes |
| Capital Gains Tax | 10% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.capital_gains_tax` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Dividend Tax | 10% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.dividend_tax` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Rental Tax Rate | 20% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.rental_tax_rate` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Withdrawal Rate (Safe Withdrawal Rate) | 4% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.withdrawal_rate` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Retirement Expense Ratio | 85% | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.retirement_expense_ratio` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Legacy Target | 0 | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.legacy_target` | `AssumptionRegistry.ts` | None in active step pipeline | Yes | No |
| Emergency Corpus Months | 12 | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.emergency_corpus_months` | `AssumptionRegistry.ts`, `GoalFundingStep.ts` | GoalFundingStep | Yes | Yes |
| Goal Funding Priority | MEDIUM | Runtime-resolved | Entity -> Type -> Household -> System Default | `planning_assumptions.goal_funding_priority` | `AssumptionRegistry.ts` | None in active step pipeline | No (not displayed in assumptions form) | No |

### 1B) Runtime-assumption inputs consumed by active steps (legacy/derived)

These are consumed by the engine but are not all first-class fields in Planning Assumptions UI.

| Runtime Input | Default | Current Effective Value | Resolution Order | Database Storage | Source File | Projection Step Using It | User Editable | Actually Used by Runtime |
|---|---:|---|---|---|---|---|---|---|
| income.monthlyIncome | 0 | Compensation-adjusted if profile exists | N/A (legacy bundle + compensation overlay) | Stored via projection event metadata (compensation profile) | `compensation.ts`, `IncomeStep.ts` | IncomeStep | Indirect (Compensation profile) | Yes |
| income.bonusAmount | 0 | Compensation-adjusted | N/A | Projection event metadata | `compensation.ts`, `IncomeStep.ts` | IncomeStep | Indirect | Yes |
| income.bonusMonth | 3 | Compensation-adjusted | N/A | Projection event metadata | `compensation.ts`, `IncomeStep.ts` | IncomeStep | Indirect | Yes |
| income.otherMonthlyIncome | 0 | Legacy assumptions bundle | N/A | Legacy assumptions record | `AssumptionService.ts`, `IncomeStep.ts` | IncomeStep | Limited/legacy path | Yes |
| income.salaryStopYear / salaryStopMonth | Derived from retirement age / 12 | Derived at runtime map | N/A | Not directly stored | `AssumptionService.ts`, `step-helpers.ts` | IncomeStep helper `isSalaryActive` | No direct field | Yes |
| investments.monthlySipAmount | 0 | Scenario/user legacy value | N/A | Legacy assumptions record | `AssumptionService.ts`, `InvestmentStep.ts` | InvestmentStep | Limited/legacy path | Yes |
| investments.stockInvestmentAmount | 0 | Scenario/user legacy value | N/A | Legacy assumptions record | `AssumptionService.ts`, `InvestmentStep.ts` | InvestmentStep | Limited/legacy path | Yes |
| investments.annualIncrementRate | Salary Growth defaulted | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts` | No active step usage | No | No |
| investments.expectedReturnRate | Equity return mapped | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts` | Not used by active InvestmentStep return math | No | No (active step path) |
| investments.fixedDepositRate | Debt return mapped | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts` | Not used by active InvestmentStep return math | No | No (active step path) |
| investments.goldAppreciationRate | Gold return mapped | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts` | Not used by active InvestmentStep return math | No | No (active step path) |
| investments.realEstateAppreciationRate | Real estate return mapped | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts`, `InvestmentStep.ts` | InvestmentStep | No direct UI field (derived from canonical) | Yes |
| loans.averageInterestRate | Home loan interest mapped | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts`, `LoanStep.ts` | LoanStep fallback | No direct UI field (derived from canonical) | Yes |
| loans.emiIncrementRate | 0 | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts`, `LoanStep.ts` | LoanStep | No (assumptions UI) | Yes |
| loans.annualPrepaymentAmount | 0 | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts`, `LoanStep.ts` | LoanStep | No (assumptions UI) | Yes |
| loans.annualPrepaymentMonth | 3 | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts`, `LoanStep.ts` | LoanStep | No (assumptions UI) | Yes |
| loans.useExtraCashForPrepayment | `loanPrepaymentStrategy != NONE` | Derived | N/A | Derived | `AssumptionService.ts`, `LoanStep.ts` | LoanStep | Via canonical field | Yes |
| retirement.epfEmployeeContributionRate | 0 | Compensation-adjusted | N/A | Projection event metadata | `compensation.ts`, `InvestmentStep.ts` | InvestmentStep | Indirect | Yes |
| retirement.epfEmployerContributionRate | 0 | Compensation-adjusted | N/A | Projection event metadata | `compensation.ts`, `InvestmentStep.ts` | InvestmentStep | Indirect | Yes |
| retirement.npsContributionRate | 0 | Compensation-adjusted | N/A | Projection event metadata | `compensation.ts`, `InvestmentStep.ts` | InvestmentStep | Indirect | Yes |
| retirement.ppfMonthlyContribution | 0 | Legacy value | N/A | Legacy assumptions record | `AssumptionService.ts`, `InvestmentStep.ts` | InvestmentStep | No (assumptions UI) | Yes |
| tax.effectiveTaxRate | 20 (default) | compensation/profile or canonical incomeTaxRate | N/A | Legacy assumptions + compensation profile | `ProjectionInputService.ts`, `TaxStep.ts` | TaxStep | Partially (canonical editable) | Yes |
| planning.endYear/endMonth | now+30 / 12 | Legacy planning horizon | N/A | Legacy assumptions record | `ProjectionEngine.ts`, `ProjectionInputService.ts` | Timeline bounds | No (assumptions UI) | Yes |
| planning.startMonth | current month | Legacy planning horizon | N/A | Legacy assumptions record | `ProjectionInputService.ts` | Start month + age offset | No (assumptions UI) | Yes |

## 2) GAP ANALYSIS

### A) Editable but not used (active step runtime)

1. `lifeExpectancy`
2. `spouseLifeExpectancy`
3. `bonusGrowthRate`
4. `businessIncomeGrowth`
5. `rentalIncomeGrowth`
6. `otherIncomeGrowth`
7. `medicalInflation`
8. `educationInflation`
9. `lifestyleInflation`
10. `propertyInflation`
11. `luxuryInflation`
12. `debtReturn` (mapped only; not consumed by active return logic)
13. `silverReturn`
14. `carLoanInterest`
15. `personalLoanInterest`
16. `capitalGainsTax`
17. `dividendTax`
18. `rentalTaxRate`
19. `withdrawalRate`
20. `retirementExpenseRatio`
21. `legacyTarget`

### B) Used but not editable (in Planning Assumptions UI)

1. `income.monthlyIncome`, `bonusAmount`, `bonusMonth` (editable via compensation profile, not assumptions form)
2. `investments.monthlySipAmount`, `stockInvestmentAmount`
3. `loans.emiIncrementRate`, `loans.annualPrepaymentAmount`, `loans.annualPrepaymentMonth`
4. `retirement.ppfMonthlyContribution`
5. `planning.startMonth`, `planning.endYear`, `planning.endMonth`

### C) Hardcoded defaults / constants

1. System default baseline values in Assumption Registry (all canonical defaults)
2. Legacy bundle constants:
   - `bonusMonth = 3`
   - `annualPrepaymentMonth = 3`
   - `emiIncrementRate = 0`
   - `monthlySipAmount = 0`
   - `stockInvestmentAmount = 0`
3. Salary stop month fixed at `12` in legacy mapping

### D) Duplicated semantics

1. `salaryGrowthRate` and legacy `income.annualIncrementRate` both represent salary/bonus growth cadence.
2. `equityReturn` and legacy `investments.expectedReturnRate` overlap.
3. `goldReturn` and legacy `investments.goldAppreciationRate` overlap.
4. `homeLoanInterest` and legacy `loans.averageInterestRate` overlap.

### E) Legacy artifacts

1. Legacy assumptions bundle fields still drive parts of the active runtime.
2. Compensation overlay mutates legacy bundle values after assumptions resolution.
3. Several canonical assumptions are mapped into legacy fields that the active step pipeline does not consume.

### F) Missing from assumptions UI (for active runtime behavior)

1. SIP step-up/increase control (distinct from salary growth)
2. EMI annual increment
3. Annual prepayment amount/month
4. Planning horizon controls (`startMonth`, `endYear`, `endMonth`)
5. PPF monthly contribution control
6. A distinct post-retirement return assumption key
7. `goalFundingPriority` is in model but not displayed in the current assumptions form

## 3) IMPACT MATRIX (Assumption -> Dashboard KPI impact)

Legend:

- Direct: assumption affects KPI in active runtime path.
- Indirect: assumption affects upstream value or fallback path.
- None: no active runtime impact currently.

### 3A) Canonical assumptions

| Assumption | Impacted Dashboard KPIs |
|---|---|
| currentAge | Monthly timeline age in projection context (indirect to planned metrics date alignment) |
| retirementAge | Monthly Summary Income/Expenses/Savings, Net Worth planned/variance (via salary stop), Investments planned/variance, Retirement planned/variance |
| lifeExpectancy | None (active runtime) |
| spouseLifeExpectancy | None (active runtime) |
| salaryGrowthRate | Monthly Summary Income/Savings, Net Worth planned/variance, Investments planned/variance, Financial Health |
| bonusGrowthRate | None (active runtime) |
| businessIncomeGrowth | None (active runtime) |
| rentalIncomeGrowth | None (active runtime) |
| otherIncomeGrowth | None (active runtime) |
| generalInflation | Monthly Summary Expenses/Savings, Net Worth planned/variance, Financial Health |
| medicalInflation | None (active runtime) |
| educationInflation | None (active runtime) |
| lifestyleInflation | None (active runtime) |
| propertyInflation | None (active runtime) |
| luxuryInflation | None (active runtime) |
| equityReturn | Investments planned/variance, Net Worth planned/variance, Financial Health |
| debtReturn | None (active step path) |
| goldReturn | Investments planned/variance, Net Worth planned/variance |
| silverReturn | None (active step path) |
| realEstateReturn | Net Worth planned/variance, Investments planned/variance (through total net worth effects) |
| cashReturn | Net Worth planned/variance, Monthly Summary (cash dynamics) |
| epfReturn | Retirement planned/variance, Net Worth planned/variance |
| ppfReturn | Retirement planned/variance, Net Worth planned/variance |
| npsEquityReturn | Retirement planned/variance, Net Worth planned/variance |
| npsDebtReturn | Retirement planned/variance, Net Worth planned/variance |
| homeLoanInterest | Liabilities planned/variance, Monthly Summary Expenses/Savings, Net Worth planned/variance |
| carLoanInterest | None (active step path) |
| personalLoanInterest | None (active step path) |
| loanPrepaymentStrategy | Liabilities planned/variance, Monthly Summary Savings, Net Worth planned/variance |
| incomeTaxRate | Monthly Summary Taxes/Expenses/Savings, Net Worth planned/variance |
| capitalGainsTax | None (active runtime) |
| dividendTax | None (active runtime) |
| rentalTaxRate | None (active runtime) |
| withdrawalRate | None (active runtime) |
| retirementExpenseRatio | None (active runtime) |
| legacyTarget | None (active runtime) |
| emergencyCorpusMonths | Goals funding, Monthly Summary Savings, Net Worth planned/variance |
| goalFundingPriority | None (active runtime) |

### 3B) Additional runtime-only inputs

| Runtime Input | Impacted Dashboard KPIs |
|---|---|
| income.monthlyIncome / bonusAmount / bonusMonth | Monthly Summary Income/Savings, Net Worth planned/variance |
| investments.monthlySipAmount / stockInvestmentAmount | Investments monthly investment, Investments planned/variance, Net Worth planned/variance |
| loans.annualPrepaymentAmount / annualPrepaymentMonth / emiIncrementRate | Liabilities planned/variance, Monthly Summary Expenses/Savings, Net Worth planned/variance |
| retirement contribution rates | Retirement planned/variance, Net Worth planned/variance |
| planning.startMonth / endYear / endMonth | Which period planned values represent; all planned/variance KPIs |

## 4) EXPLAINABILITY REPORT DESIGN (No implementation)

Target capability: "Explain this Number" for every major KPI on Executive Dashboard.

### 4A) Proposed explainability payload (per KPI)

```
{
  kpiKey: string,
  asOfMonth: string,
  value: number,
  formula: string,
  inputs: [
    { name, value, unit, sourceType, sourcePath }
  ],
  assumptions: [
    { key, resolvedValue, sourceScope, overridden }
  ],
  services: [string],
  projectionRun: { scenarioId, startMonth, horizonEndYear, snapshotId }
}
```

### 4B) KPI-by-KPI explainability blueprint

| KPI | Source data | Formula | Assumptions used | Projection date | Services involved |
|---|---|---|---|---|---|
| Net Worth (Current) | Balance sheet totals | `assets - liabilities` | None (current snapshot) | Current data as-of | `getBalanceSheetData` |
| Net Worth (Planned) | First projected snapshot closing balances | `closingBalances.netWorth` | salaryGrowthRate, generalInflation, equity/gold/cash/retirement returns, incomeTaxRate, loan assumptions, emergencyCorpusMonths, retirementAge | First month of projection | `projectionInputService`, `projectionEngine`, `ExecutiveDashboardService` |
| Net Worth Variance | Current + Planned values | `currentNetWorth - plannedNetWorth` | Same as planned NW | Same projected month | `ExecutiveDashboardService` |
| Investments (Current Portfolio) | Category totals from balance sheet | `investments + fixedDeposits + goldAndSilver` | None | Current data as-of | `getBalanceSheetData`, `ExecutiveDashboardService` |
| Investments (Planned Portfolio) | First projected snapshot | `plannedInvestments - plannedRetirement` | equityReturn, goldReturn, realEstateReturn, cashReturn, EPF/PPF/NPS returns, SIP/invest contribution assumptions | First month of projection | `projectionEngine`, `ExecutiveDashboardService` |
| Investments Variance | Current + Planned portfolio | `currentNonRetirement - plannedNonRetirement` | Same as planned investments | Same projected month | `ExecutiveDashboardService` |
| Liabilities (Current Outstanding) | Loan summary from liabilities | Sum outstanding by active loans | None | Current data as-of | `buildLoanSummaryFromLiabilities` |
| Liabilities (Planned Outstanding) | First projected snapshot liabilities | `closingBalances.liabilities` | homeLoanInterest fallback, loan prepayment controls, EMI increment, liability-level rates | First month of projection | `LoanStep`, `projectionEngine` |
| Liabilities Variance | Current + Planned liabilities | `currentOutstanding - plannedOutstanding` | Same as planned liabilities | Same projected month | `ExecutiveDashboardService` |
| Retirement (Current) | Retirement summary | Sum retirement assets | None | Current data as-of | `getRetirementSummary` |
| Retirement (Planned) | First projected snapshot retirement balance | `closingBalances.retirement` | epfReturn, ppfReturn, npsEquityReturn, npsDebtReturn, contribution rates | First month of projection | `InvestmentStep`, `projectionEngine` |
| Retirement Variance | Current + Planned retirement | `currentRetirement - plannedRetirement` | Same as planned retirement | Same projected month | `ExecutiveDashboardService` |
| Monthly Income | Projection monthly or fallback | Sum salary + bonus + rental + business + other | salaryGrowthRate, monthlyIncome/bonus assumptions, retirementAge (salary stop) | First month of projection | `IncomeStep`, `ExecutiveDashboardService` |
| Monthly Expenses | Projection monthly or fallback | living + insurance + taxes + EMI | generalInflation, incomeTaxRate, loan assumptions | First month of projection | `ExpenseStep`, `TaxStep`, `LoanStep` |
| Monthly Savings | Derived monthly | `income - expenses` | same as income and expenses | First month of projection | `ExecutiveDashboardService` |
| Financial Health Score | Balance-sheet + projected trend stats | Composite scoring function | Indirectly inherits assumptions through projected trend | Current + projected month | `buildFinancialHealthScore` |

### 4C) UX behavior recommendation for explainability

1. Add an "Explain" icon on each widget headline.
2. Open a side panel with:
   - Definition
   - Formula
   - Inputs table
   - Assumption lineage (value + source scope)
   - "Why changed from plan" delta breakdown
3. Include "As of" and "Projection Month" stamps explicitly.
4. Add "Data freshness" and "Source confidence" badges.

## 5) PRODUCT RECOMMENDATIONS

### Immediate (low risk)

1. Add runtime-usage badges in assumptions UI: "Used in Projection" vs "Not currently used".
2. Surface assumption provenance in UI (System default / Household / Entity type / Entity instance).
3. Add read-only panel showing unresolved vs resolved value for each assumption key.
4. Add warning callouts for editable-but-not-used assumptions.
5. Show canonical projection month used for planned dashboard values.

### Medium-term

1. Eliminate duplicated semantics between canonical assumptions and legacy bundle where possible.
2. Add missing assumptions UI controls for actively used legacy fields:
   - SIP step-up
   - EMI increment
   - Annual prepayment amount/month
   - Planning horizon controls
   - PPF monthly contribution
3. Wire currently editable canonical assumptions into active runtime steps where intended:
   - life expectancy
   - withdrawal rate
   - retirement expense ratio
   - tax sub-types
   - silver and debt return pathways
4. Introduce a "coverage contract" test that fails CI if an editable canonical assumption is unused without explicit annotation.

### Future roadmap

1. Move from mixed canonical+legacy assumptions to a single strongly typed assumptions graph used by all engines.
2. Add simulation explainability lineage store (per run snapshot) for deterministic replay and audit trails.
3. Build policy-based assumptions governance:
   - approval workflow for major assumption changes
   - scenario diff reviews
   - historical version impact analysis
4. Add user-facing "What changed since last run" narrative powered by assumption deltas.

## 6) Key Trust Conclusions

1. The framework has robust assumption modeling and persistence but partial runtime coverage.
2. The active projection pipeline uses a subset of canonical assumptions and several legacy/derived fields.
3. There is a transparency gap: user-editable fields may not affect runtime outcomes.
4. Explainability is feasible now with minimal architectural change by exposing existing lineage + formula metadata.

# ProjectionCoverage

## Scope
This audit covers the runtime projection path used by Projection Viewer and the assumption model that feeds it.

Primary runtime anchors:
- Viewer entry: [src/app/projection-viewer/page.tsx](src/app/projection-viewer/page.tsx#L161)
- Assumption bundle load: [src/services/assumptions.ts](src/services/assumptions.ts#L49)
- Runtime context build: [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts#L440)
- Monthly engine: [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L235)
- Monthly ledger assembly: [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L219)
- Snapshot assembly: [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L200)
- Viewer rendering of calculated balances: [src/app/projection-viewer/page.tsx](src/app/projection-viewer/page.tsx#L210)

Legend:
- Complete = directly affects monthly projections today.
- Partial = runtime uses a derivative, alias, or only a subset of the intended semantics.
- Missing = defined in the model but not executed in the runtime projection pipeline.
- Dead Code = only consumed by orphaned projection helpers/processors that are no longer on the runtime path.
- Future = tracked in planning, but not part of Projection Engine scope.

## Runtime Projection Pipeline
Projection Viewer -> ProjectionInputService -> ProjectionEngine -> ProjectionPipeline -> IncomeStep -> ExpenseStep -> InsuranceStep -> LoanStep -> InvestmentStep -> TaxStep -> GoalFundingStep -> NetWorthStep -> Monthly Ledger -> Snapshot -> Projection Viewer

Execution path with controlling files:
- [src/app/projection-viewer/page.tsx](src/app/projection-viewer/page.tsx#L161) calls projectionInputService.buildContext(...) and then [ProjectionEngine.run](src/services/projection/ProjectionEngine.ts#L282).
- [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts#L440) loads the legacy assumptions bundle and effective planning assumptions, then seeds currentRecord and currentState.
- [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L235) builds the runtime pipeline with only step classes.
- [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L299) runs the pipeline month by month and rolls forward state.
- [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L219) and [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L200) build the monthly ledger, projected entities, and snapshots.
- [src/app/projection-viewer/page.tsx](src/app/projection-viewer/page.tsx#L210) renders the calculated snapshot balances, not static source values.

## Assumption Coverage Matrix

### Runtime Bundle Assumptions
These are the fields materialized by [src/services/assumptions.ts](src/services/assumptions.ts#L49) from the planning assumption service.

| Assumption | Category | Runtime Used (Yes/No) | Consumed By | Status | Recommendation |
|---|---|---:|---|---|---|
| income.monthlyIncome | income | Yes | ProjectionInputService -> IncomeStep | Complete | Keep. |
| income.annualIncrementRate | income | Yes | ProjectionInputService -> IncomeStep bonus compounding | Partial | Keep, but note it is an alias-style field and does not represent bonusGrowthRate directly. |
| income.salaryGrowthRate | income | Yes | ProjectionInputService -> IncomeStep salary compounding | Complete | Keep. |
| income.bonusAmount | income | Yes | ProjectionInputService -> IncomeStep | Complete | Keep. |
| income.bonusMonth | income | Yes | ProjectionInputService -> IncomeStep | Complete | Keep. |
| income.otherMonthlyIncome | income | Yes | ProjectionInputService -> IncomeStep | Complete | Keep. |
| income.salaryStopMonth | income | Yes | ProjectionInputService -> step-helpers.isSalaryActive | Complete | Keep. |
| income.salaryStopYear | income | Yes | ProjectionInputService -> step-helpers.isSalaryActive | Complete | Keep. |
| investments.monthlySipAmount | investments | Yes | ProjectionInputService -> InvestmentStep | Complete | Keep. |
| investments.stockInvestmentAmount | investments | Yes | ProjectionInputService -> InvestmentStep | Complete | Keep. |
| investments.annualIncrementRate | investments | No | None in runtime projection | Missing | Remove or wire into a runtime rule if growth escalation is intended. |
| investments.expectedReturnRate | investments | Yes | ProjectionInputService -> InvestmentStep | Complete | Keep. |
| investments.fixedDepositRate | investments | Yes | ProjectionInputService -> InvestmentStep retirement return calculation | Complete | Keep, but note it is being used as the retirement corpus return proxy. |
| investments.goldAppreciationRate | investments | No | None in runtime projection | Missing | Wire into monthly asset growth or retire the field. |
| investments.realEstateAppreciationRate | investments | Yes | ProjectionInputService -> InvestmentStep | Complete | Keep. |
| inflation.generalInflationRate | inflation | Yes | ProjectionInputService -> ExpenseStep | Complete | Keep. |
| inflation.educationInflationRate | inflation | No | None in runtime projection | Missing | Wire into goal cost escalation if education projections are meant to move. |
| inflation.healthcareInflationRate | inflation | No | None in runtime projection | Missing | Wire into healthcare/retirement expense escalation if intended. |
| inflation.retirementInflationRate | inflation | No | None in runtime projection | Missing | Wire into retirement drawdown or expense modeling if intended. |
| loans.averageInterestRate | loans | Yes | ProjectionInputService -> LoanStep | Complete | Keep. |
| loans.emiIncrementRate | loans | Yes | ProjectionInputService -> LoanStep | Complete | Keep. |
| loans.annualPrepaymentAmount | loans | No | None in runtime projection | Missing | Wire into loan principal reduction or remove. |
| loans.annualPrepaymentMonth | loans | No | None in runtime projection | Missing | Wire into annual prepayment scheduling or remove. |
| loans.useExtraCashForPrepayment | loans | No | None in runtime projection | Missing | Either implement prepayment routing or retire the flag. |
| retirement.epfEmployeeContributionRate | retirement | Yes | ProjectionInputService -> InvestmentStep | Complete | Keep. |
| retirement.epfEmployerContributionRate | retirement | Yes | ProjectionInputService -> InvestmentStep | Complete | Keep. |
| retirement.npsContributionRate | retirement | Yes | ProjectionInputService -> InvestmentStep | Complete | Keep. |
| retirement.ppfMonthlyContribution | retirement | No | ContributionProcessor only, which is not on the runtime path | Dead Code | Either reattach the processor path or remove the orphaned field. |
| retirement.retirementTargetAge | retirement | No | None in runtime projection | Missing | If retirement timing matters, wire it into salary stop or retirement drawdown logic. |
| retirement.salaryStopMonth | retirement | No | Duplicate of income.salaryStopMonth; not read by runtime | Dead Code | Remove the duplicate or normalize to a single source of truth. |
| retirement.salaryStopYear | retirement | No | Duplicate of income.salaryStopYear; not read by runtime | Dead Code | Remove the duplicate or normalize to a single source of truth. |
| tax.regime | tax | No | Only copied into ProjectionContext.tax profile | Missing | If tax regime matters for projection math, add a runtime rule. |
| tax.effectiveTaxRate | tax | Yes | ProjectionInputService -> TaxStep | Complete | Keep. |
| tax.surchargeRate | tax | No | None in runtime projection | Missing | Wire into tax calculation or remove. |
| tax.cessRate | tax | No | None in runtime projection | Missing | Wire into tax calculation or remove. |
| tax.note | tax | No | None in runtime projection | Missing | Metadata only today. |
| planning.startMonth | planning | Yes | ProjectionInputService -> ProjectionEngine timeline seed | Complete | Keep. |
| planning.endYear | planning | Yes | ProjectionInputService -> ProjectionEngine timeline seed | Complete | Keep. |
| planning.endMonth | planning | Yes | ProjectionInputService -> ProjectionEngine timeline seed | Complete | Keep. |

### Planning Assumptions
These are the planning-model values in [src/services/planning/assumptions/AssumptionTypes.ts](src/services/planning/assumptions/AssumptionTypes.ts#L20) and [src/services/planning/assumptions/AssumptionRegistry.ts](src/services/planning/assumptions/AssumptionRegistry.ts#L18). They are copied into an effective assumptions bundle, but only some are consumed by Projection Engine.

| Assumption | Category | Runtime Used (Yes/No) | Consumed By | Status | Recommendation |
|---|---|---:|---|---|---|
| currentAge | PERSONAL | Yes | ProjectionInputService starting age seed; ProjectionEngine opening age | Complete | Keep. |
| retirementAge | PERSONAL | Yes | AssumptionService legacy bundle mapping -> income.salaryStopYear | Partial | Keep if you want salary stop timing, but the retirement-phase model itself is still missing. |
| lifeExpectancy | PERSONAL | No | None in runtime projection | Missing | Wire into retirement horizon or drawdown logic if intended. |
| spouseLifeExpectancy | PERSONAL | No | None in runtime projection | Missing | Wire into household retirement horizon if intended. |
| salaryGrowthRate | INCOME | Yes | AssumptionService legacy bundle mapping -> income.salaryGrowthRate | Complete | Keep. |
| bonusGrowthRate | INCOME | No | None in runtime projection | Missing | Wire into bonus growth or remove the unused field. |
| businessIncomeGrowth | INCOME | No | None in runtime projection | Missing | Wire into business income escalation or remove the unused field. |
| rentalIncomeGrowth | INCOME | No | None in runtime projection | Missing | Wire into rental income escalation or remove the unused field. |
| otherIncomeGrowth | INCOME | No | None in runtime projection | Missing | Wire into other income escalation or remove the unused field. |
| generalInflation | INFLATION | Yes | AssumptionService legacy bundle mapping -> inflation.generalInflationRate -> ExpenseStep | Complete | Keep. |
| medicalInflation | INFLATION | No | None in runtime projection | Missing | Wire into healthcare expense growth or retire the field. |
| educationInflation | INFLATION | No | None in runtime projection | Missing | Wire into education goal growth or retire the field. |
| lifestyleInflation | INFLATION | No | None in runtime projection | Missing | Wire into retirement expense escalation or retire the field. |
| propertyInflation | INFLATION | No | None in runtime projection | Missing | Wire into property expense growth or retire the field. |
| luxuryInflation | INFLATION | No | None in runtime projection | Missing | Wire into discretionary spend growth or retire the field. |
| equityReturn | INVESTMENTS | Yes | AssumptionService legacy bundle mapping -> investments.expectedReturnRate -> InvestmentStep | Complete | Keep. |
| debtReturn | INVESTMENTS | Yes | AssumptionService legacy bundle mapping -> investments.fixedDepositRate -> InvestmentStep | Partial | Keep if fixed-deposit return is the intended proxy, otherwise split debt and deposit logic. |
| goldReturn | INVESTMENTS | No | None in runtime projection | Missing | Wire into gold appreciation or retire the field. |
| silverReturn | INVESTMENTS | No | None in runtime projection | Missing | Wire into silver appreciation or retire the field. |
| realEstateReturn | INVESTMENTS | Yes | AssumptionService legacy bundle mapping -> investments.realEstateAppreciationRate -> InvestmentStep | Complete | Keep. |
| cashReturn | INVESTMENTS | No | None in runtime projection | Missing | Wire into cash yield modeling or retire the field. |
| epfReturn | INVESTMENTS | No | None in runtime projection | Missing | Wire into EPF growth logic or retire the field. |
| ppfReturn | INVESTMENTS | No | None in runtime projection | Missing | Wire into PPF growth logic or retire the field. |
| npsEquityReturn | INVESTMENTS | No | None in runtime projection | Missing | Wire into NPS accumulation logic or retire the field. |
| npsDebtReturn | INVESTMENTS | No | None in runtime projection | Missing | Wire into NPS accumulation logic or retire the field. |
| homeLoanInterest | LOANS | Yes | AssumptionService legacy bundle mapping -> loans.averageInterestRate -> LoanStep | Complete | Keep. |
| carLoanInterest | LOANS | No | None in runtime projection | Missing | Wire into per-liability interest selection or retire the field. |
| personalLoanInterest | LOANS | No | None in runtime projection | Missing | Wire into per-liability interest selection or retire the field. |
| loanPrepaymentStrategy | LOANS | No | None in runtime projection | Missing | The runtime ignores prepayment policy today; wire it or remove it. |
| incomeTaxRate | TAXES | Yes | AssumptionService legacy bundle mapping -> tax.effectiveTaxRate -> TaxStep | Complete | Keep. |
| capitalGainsTax | TAXES | No | None in runtime projection | Missing | Wire into taxable investment gain modeling or retire the field. |
| dividendTax | TAXES | No | None in runtime projection | Missing | Wire into dividend taxation or retire the field. |
| rentalTaxRate | TAXES | No | None in runtime projection | Missing | Wire into rental income taxation or retire the field. |
| withdrawalRate | RETIREMENT | No | None in runtime projection | Missing | Wire into retirement drawdown or retire the field. |
| retirementExpenseRatio | RETIREMENT | No | None in runtime projection | Missing | Wire into retirement expense modeling or retire the field. |
| legacyTarget | RETIREMENT | No | None in runtime projection | Missing | Wire into end-of-life corpus planning or retire the field. |
| emergencyCorpusMonths | RETIREMENT | Yes | GoalFundingStep | Complete | Keep. |
| goalFundingPriority | RETIREMENT | No | Planning-only; not used by Projection Engine | Future | Keep for planning workflows, but do not count it as runtime projection logic. |

## InvestmentStep Audit
The runtime engine now uses a single monthly InvestmentStep instead of the old event-based contribution/growth processors.

| Investment-related assumption | Enters runtime from | Calculated in | Updates monthly ledger | Reaches Projection Viewer | Notes |
|---|---|---|---:|---:|---|
| monthlySipAmount | Assumption bundle -> ProjectionInputService -> InvestmentStep | [src/services/projection/steps/InvestmentStep.ts](src/services/projection/steps/InvestmentStep.ts#L16) | Yes | Yes | Contributes to investmentContributions and closingInvestments. |
| stockInvestmentAmount | Assumption bundle -> ProjectionInputService -> InvestmentStep | [src/services/projection/steps/InvestmentStep.ts](src/services/projection/steps/InvestmentStep.ts#L16) | Yes | Yes | Contributes to investmentContributions and closingInvestments. |
| expectedReturnRate | Assumption bundle -> ProjectionInputService -> InvestmentStep | [src/services/projection/steps/InvestmentStep.ts](src/services/projection/steps/InvestmentStep.ts#L23) | Yes | Yes | Drives investmentReturns. |
| fixedDepositRate | Assumption bundle -> ProjectionInputService -> InvestmentStep | [src/services/projection/steps/InvestmentStep.ts](src/services/projection/steps/InvestmentStep.ts#L24) | Yes | Yes | Drives retirementReturns and is the current stand-in for retirement corpus growth. |
| realEstateAppreciationRate | Assumption bundle -> ProjectionInputService -> InvestmentStep | [src/services/projection/steps/InvestmentStep.ts](src/services/projection/steps/InvestmentStep.ts#L25) | Yes | Yes | Drives assetAppreciation. |
| epfEmployeeContributionRate | Assumption bundle -> ProjectionInputService -> InvestmentStep | [src/services/projection/steps/InvestmentStep.ts](src/services/projection/steps/InvestmentStep.ts#L13) | Yes | Yes | Added into retirementContributions. |
| epfEmployerContributionRate | Assumption bundle -> ProjectionInputService -> InvestmentStep | [src/services/projection/steps/InvestmentStep.ts](src/services/projection/steps/InvestmentStep.ts#L13) | Yes | Yes | Added into retirementContributions. |
| npsContributionRate | Assumption bundle -> ProjectionInputService -> InvestmentStep | [src/services/projection/steps/InvestmentStep.ts](src/services/projection/steps/InvestmentStep.ts#L14) | Yes | Yes | Added into retirementContributions. |
| ppfMonthlyContribution | Assumption bundle -> legacy ContributionProcessor only | [src/services/projection/ContributionProcessor.ts](src/services/projection/ContributionProcessor.ts#L68) | No | No | Dead path only; not part of current runtime pipeline. |
| goldAppreciationRate | Assumption bundle -> legacy GrowthProcessor only | [src/services/projection/GrowthProcessor.ts](src/services/projection/GrowthProcessor.ts#L175) | No | No | Dead path only; current InvestmentStep ignores gold growth entirely. |
| silverReturn | Planning model only; no runtime bundle consumer | None | No | No | Missing rule in runtime projection. |
| epfReturn | Planning model only; no runtime bundle consumer | None | No | No | Missing rule in runtime projection. |
| ppfReturn | Planning model only; no runtime bundle consumer | None | No | No | Missing rule in runtime projection. |
| npsEquityReturn | Planning model only; no runtime bundle consumer | None | No | No | Missing rule in runtime projection. |
| npsDebtReturn | Planning model only; no runtime bundle consumer | None | No | No | Missing rule in runtime projection. |

## Missing Rule Inventory
These rules exist in the assumptions model, but the runtime Projection Engine does not execute them today.

- Bonus growth is not driven by bonusGrowthRate. The runtime instead reuses salaryGrowthRate through the legacy bundle alias income.annualIncrementRate.
- Separate growth rules for businessIncomeGrowth, rentalIncomeGrowth, and otherIncomeGrowth are not executed.
- Education, medical, lifestyle, property, and luxury inflation do not affect any monthly projection step.
- Gold and silver appreciation are not applied in the current monthly engine.
- EPF, PPF, and NPS-specific return assumptions are not executed in the current runtime pipeline.
- cashReturn is not used for any cash yield or surplus-cash rule.
- carLoanInterest, personalLoanInterest, and loanPrepaymentStrategy are not executed in loan amortization.
- annualPrepaymentAmount, annualPrepaymentMonth, and useExtraCashForPrepayment are not executed.
- withdrawalRate, retirementExpenseRatio, and legacyTarget do not affect retirement drawdown.
- capitalGainsTax, dividendTax, rentalTaxRate, surchargeRate, cessRate, and tax.regime do not affect tax math.
- lifeExpectancy and spouseLifeExpectancy are tracked in planning but do not shape the monthly projection timeline or retirement phase.
- goalFundingPriority is a planning-only selector and does not change Projection Engine behavior.

## Dead Code Inventory
These projection classes, services, helpers, or exports are no longer part of the runtime execution path.

- [src/services/projection/ContributionProcessor.ts](src/services/projection/ContributionProcessor.ts#L68) and its exported contributionProcessor are not invoked by [ProjectionEngine](src/services/projection/ProjectionEngine.ts#L235).
- [src/services/projection/GrowthProcessor.ts](src/services/projection/GrowthProcessor.ts#L175) and its exported growthProcessor are not invoked by [ProjectionEngine](src/services/projection/ProjectionEngine.ts#L235).
- [src/services/projection/EventEngine.ts](src/services/projection/EventEngine.ts#L73) and the exported projectionEventEngine are no longer wired into the runtime pipeline.
- [src/services/projection/MonthlyLedger.ts](src/services/projection/MonthlyLedger.ts#L3) and [src/services/projection/MonthlyLedger.ts](src/services/projection/MonthlyLedger.ts#L7) are exported but not used by the current engine, which appends ledger entries inline.
- [src/services/projection/index.ts](src/services/projection/index.ts#L9) through [src/services/projection/index.ts](src/services/projection/index.ts#L13) re-export the dead event processors and monthly-ledger helpers, but nothing in the current runtime path consumes those exports.

## Architectural Summary
The current Projection Engine is a step-based monthly simulator. It consumes only a narrow subset of the assumptions model directly, and several planning assumptions are either partially mapped through legacy aliases or completely ignored.

The main architectural gaps are:
- legacy bundle aliases are still carrying semantics that are not represented one-to-one in the planning model,
- several planning assumptions are modeled but never executed in monthly projection math,
- the old event-driven contribution/growth processors remain in the codebase but are no longer on the runtime path.

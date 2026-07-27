# FINANCIAL PLANNING INFORMATION ARCHITECTURE

Date: 2026-07-27

## 1) Target Navigation

### Primary navigation model

1. Dashboard
2. Financial Planning
3. Assets
4. Investments
5. Liabilities
6. Retirement
7. Compensation
8. Cash Flow
9. Reports
10. Settings

### Financial Planning sub-navigation

1. Assumptions
2. Scenarios
3. Goals
4. Projections
5. What-if Analysis
6. Explainability
7. Insights (AI Coaching)

### Navigation rules

1. Settings contains account and system preferences only.
2. All projection inputs and outputs are discoverable under Financial Planning.
3. Each planning section links forward to the next step in workflow.

## 2) Module Operating Model

Financial Planning becomes the product control center. All projected insights must originate from one shared context:

Planning Context Contract

1. Household profile
2. Current financial state snapshot
3. Effective assumptions (resolved)
4. Scenario overrides
5. Goal set and priorities
6. Event stream
7. Planning horizon

Every engine consumes this contract:

1. Deterministic projection engine
2. Monte Carlo simulation engine
3. Recommendation engine
4. AI coaching engine
5. Tax optimization engine
6. Explainability engine

## 3) Section-by-Section Design

## 3.1 Assumptions

Purpose:

Define and govern all forward-looking planning inputs.

Primary user:

Planner, advisor, power user.

Data consumed:

1. System defaults
2. Household profile
3. Scenario and goal overrides
4. Historical assumption versions

Data produced:

1. Effective assumptions snapshot
2. Assumption lineage metadata
3. Version history and change logs

Dependencies:

1. Scenario manager
2. Goal manager
3. Projection engine
4. Explainability service

Future extensibility:

1. Assumption confidence bands
2. Regional presets
3. Advisor templates
4. Collaboration and approval workflow

Business grouping model:

1. Income
- Salary Growth
- Bonus Growth
- Other Income Growth
- Retirement Age
2. Investments
- Mutual Fund Return
- Equity Return
- PPF Return
- EPF Return
- NPS Return
- Fixed Deposit Return
- Gold Return
- Cash Return
- Real Estate Return
3. Investment Behavior
- SIP Step-up
- Annual Lumpsum
- Bonus Investment Percent
- Salary Savings Rate
4. Loans
- Home Loan Interest
- Car Loan Interest
- Annual Prepayment
- EMI Step-up
5. Inflation
- General
- Medical
- Education
- Lifestyle
- Property
6. Retirement
- Retirement Age
- Life Expectancy
- Post Retirement Return
- Safe Withdrawal Rate
7. Tax and Compliance
- Income Tax Assumptions
- Capital Gains Assumptions
- Deduction Strategy
8. Household and Lifecycle
- Family events
- Major lifecycle transitions

## 3.2 Scenarios

Purpose:

Create structured alternate futures and compare outcomes.

Primary user:

Planner, household decision-maker.

Data consumed:

1. Effective assumptions baseline
2. Scenario-specific overrides
3. Goals and event schedule

Data produced:

1. Scenario profile
2. Run results and KPI outputs
3. Delta vs baseline metrics

Dependencies:

1. Assumptions
2. Projection engine
3. Goal feasibility engine

Future extensibility:

1. Branching scenarios
2. Shared scenario libraries
3. Team review workflows

Scenario blueprint:

1. Conservative
- Purpose: stress resilience under lower returns and higher inflation
- Inputs overridden: returns down, inflation up, higher emergency corpus
- Outputs affected: retirement readiness, net worth trajectory, goal risk
2. Balanced
- Purpose: base planning stance
- Inputs overridden: none or moderate tuned assumptions
- Outputs affected: all baseline KPIs
3. Aggressive
- Purpose: growth-seeking path
- Inputs overridden: returns up, higher equity tilt, stronger contribution growth
- Outputs affected: investment growth, goal speed, volatility risk
4. Early Retirement
- Purpose: test retirement-before-default age
- Inputs overridden: retirement age down, withdrawal strategy and corpus threshold up
- Outputs affected: retirement sufficiency, required savings rate
5. Buy House
- Purpose: affordability and debt trade-off planning
- Inputs overridden: down payment, loan assumptions, timeline
- Outputs affected: cash flow, liabilities, goal interactions
6. Child Education
- Purpose: domestic education funding path
- Inputs overridden: goal amount, education inflation, horizon
- Outputs affected: goal feasibility, contribution requirements
7. International Education
- Purpose: high-cost education stress case
- Inputs overridden: higher education inflation and target corpus
- Outputs affected: funding gap, timeline pressure
8. Business Investment
- Purpose: evaluate entrepreneurial allocation strategy
- Inputs overridden: lumpsum outflow, expected return distribution, cash reserve floor
- Outputs affected: liquidity runway, net worth uncertainty, opportunity cost

## 3.3 Goals

Purpose:

Map life outcomes to measurable, funded targets.

Primary user:

Household planner.

Data consumed:

1. Goal definitions and priorities
2. Scenario context
3. Projection outputs

Data produced:

1. Goal feasibility score
2. Funding gap and timeline
3. Priority-driven recommendation set

Dependencies:

1. Scenarios
2. Projections
3. Explainability

Future extensibility:

1. Goal interdependency mapping
2. Dynamic reprioritization under stress

## 3.4 Projections

Purpose:

Execute, view, compare, and interpret forecast runs.

Primary user:

Planner, advisor, analyst.

Data consumed:

1. Planning Context Contract
2. Scenario selection
3. Projection horizon selection

Data produced:

1. Monthly and annual forecast timelines
2. Net worth and cash flow curves
3. Retirement and loan payoff trajectories
4. Goal achievement timeline

Dependencies:

1. Assumptions
2. Scenarios
3. Goals

Future extensibility:

1. Monte Carlo percentile bands
2. Regime switching models
3. Stress-test templates

Projection workspace tabs:

1. Monthly
2. Annual
3. Retirement
4. Age-based
5. Net Worth Forecast
6. Cash Flow Forecast
7. Investment Growth
8. Retirement Corpus
9. Loan Payoff Timeline
10. Goal Achievement Timeline

## 3.5 What-if Analysis

Purpose:

Rapidly test parameter changes and see impact deltas.

Primary user:

Decision-maker in active planning mode.

Data consumed:

1. Baseline scenario
2. Temporary parameter mutations

Data produced:

1. Delta waterfall
2. Sensitivity ranking
3. Break-even thresholds

Dependencies:

1. Projections
2. Explainability

Future extensibility:

1. Portfolio optimization heuristics
2. Tax-aware allocation optimizers

## 3.6 Explainability

Purpose:

Provide complete causal trace for every projected KPI.

Primary user:

All users, especially trust-sensitive and advisor-led users.

Data consumed:

1. Current-state inputs
2. Effective assumptions
3. Projection run metadata
4. Formula definitions
5. Engine step outputs

Data produced:

1. KPI lineage graph
2. Human-readable explanation
3. Machine-readable audit payload

Dependencies:

1. Projections
2. Assumptions
3. Formula registry

Future extensibility:

1. AI natural-language explainer
2. Compare-two-runs explainability
3. Advisor-ready export packs

Trace model per KPI:

Current Data -> Assumptions Used -> Formula -> Engine Step -> Final KPI

## 3.7 Insights (AI Coaching)

Purpose:

Convert projection outcomes into personalized, actionable coaching.

Primary user:

Mass-market users and advisor-assisted users.

Data consumed:

1. Scenario outputs
2. Assumption confidence profile
3. User behavior and constraints
4. Explainability lineage

Data produced:

1. Prioritized action plan
2. Trade-off narratives
3. Suggested scenario experiments

Dependencies:

1. Recommendation policy engine
2. Explainability service
3. Projection engines

Future extensibility:

1. Conversational AI planner
2. Trigger-based nudges
3. Autonomous review drafts for human approval

## 4) Data and Service Boundaries

### Source of truth layering

1. Financial Planning module owns forward-looking model context.
2. Operational modules (assets, liabilities, investments, compensation, cash flow) supply current-state data.
3. Dashboard and reports consume Financial Planning outputs, not ad hoc recomputation.

### Stable contracts required for no-redesign future

1. Planning Context Contract
2. Projection Run Contract
3. Scenario Comparison Contract
4. Explainability Contract
5. Recommendation Contract

### Contract extension strategy

To avoid redesign, each contract must support optional fields for:

1. Probability distributions (Monte Carlo)
2. Tax model variants
3. Strategy constraints
4. AI explanation metadata
5. Confidence and uncertainty markers

## 5) Discoverability and Workflow Design

Canonical user path:

1. Set assumptions
2. Create or select scenario
3. Run projections
4. Compare outcomes
5. Inspect explainability
6. Accept recommendations and plan actions

UX guardrails:

1. Always show active scenario context
2. Always show effective assumptions summary
3. Never show projected KPI without explainability access
4. Always preserve side-by-side baseline comparison

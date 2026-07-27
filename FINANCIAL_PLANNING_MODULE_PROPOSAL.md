# FINANCIAL PLANNING MODULE PROPOSAL

Date: 2026-07-27  
Scope: Product architecture and UX design only (no code, no engine changes)

## Executive Summary

Project North Star should elevate Financial Planning from a supporting feature into the product's core differentiator. The module should become the system-of-origin for:

1. Projection assumptions
2. Scenario definitions
3. What-if simulations
4. Goal feasibility analytics
5. Recommendation generation
6. Explainability lineage

Recommendation: adopt Option B and make Financial Planning a top-level module. Keep Settings focused on account and platform preferences.

## Part 1 - Current State

### Current navigation structure

Current primary sidebar includes operational modules (Dashboard, Assets, Investments, Retirement, Borrowings, Goals, Compensation, Cash Flow, Reports) and a Settings group that includes Planning Assumptions.

Evidence:

1. Sidebar top-level and Settings nesting: [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)
2. Settings catalog includes Planning Assumptions: [src/app/settings/page.tsx](src/app/settings/page.tsx)

### Current Planning Assumptions experience

There are two distinct routes:

1. Settings route: [src/app/settings/planning-assumptions/page.tsx](src/app/settings/planning-assumptions/page.tsx) -> currently a Coming Soon shell
2. Planning route: [src/app/planning/assumptions/page.tsx](src/app/planning/assumptions/page.tsx) -> full assumptions workspace

The full assumptions page already describes itself as the central engine and supports scope layering (User Defaults, Scenario Overrides, Goal Overrides).

Evidence:

1. Full assumptions UX and inheritance narrative: [src/components/planning/assumptions/AssumptionPage.tsx](src/components/planning/assumptions/AssumptionPage.tsx)
2. Field/section driven assumptions editor: [src/components/planning/assumptions/AssumptionForm.tsx](src/components/planning/assumptions/AssumptionForm.tsx)

### Current Projection Engine inputs

Current projection context composes from:

1. Effective assumptions from assumptions service
2. Legacy assumptions bundle (with compensation overlays)
3. Account, asset, liability, investment, retirement datasets
4. Financial events
5. Family profile for age derivation

Evidence:

1. Projection context build path: [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts)
2. Runtime pipeline sequence: [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts)

### Current Dashboard outputs

Executive dashboard consumes projection outputs and compares Current vs Planned across:

1. Net Worth
2. Investments
3. Liabilities
4. Retirement
5. Monthly summary
6. Financial health

Evidence:

1. Data assembly and planned variance mapping: [src/services/dashboard/ExecutiveDashboardService.ts](src/services/dashboard/ExecutiveDashboardService.ts)
2. Widget rendering path: [src/components/dashboard/ExecutiveDashboard.tsx](src/components/dashboard/ExecutiveDashboard.tsx)

### Current Reports

Reports route exists but is currently a placeholder hub.

Evidence:

1. Reports page placeholder state: [src/app/reports/page.tsx](src/app/reports/page.tsx)

### How users currently perform financial planning

Current practical flow:

1. Enter financial data (assets, liabilities, investments, compensation, cash flow)
2. Visit Planning workspace for assumptions, scenarios, goals, and events
3. Run/inspect projections implicitly via dashboard and projection viewer
4. Review variances and recommendation surfaces (Decision Center)

Evidence:

1. Planning workspace cards and module links: [src/app/planning/page.tsx](src/app/planning/page.tsx)
2. Planning summary and module descriptors: [src/services/planning.ts](src/services/planning.ts)
3. Projection validation workspace: [src/app/projection-viewer/page.tsx](src/app/projection-viewer/page.tsx)

### Usability issues in current state

1. Split mental model: Planning Assumptions appears under Settings but operative experience is under Planning.
2. Discoverability mismatch: high-impact planning controls are visually grouped with low-frequency profile/system settings.
3. Terminology inconsistency: users may assume Settings version is canonical, but active workflow sits in Planning.
4. Reporting/explainability gap: users can see results but cannot trace all causal chains from assumptions to KPI.
5. Projection interaction fragmentation: projections are visible in dashboard and projection viewer, without a single orchestration workspace.

## Part 2 - Should Planning Assumptions remain under Settings?

### Option A

Settings -> Planning Assumptions

Strengths:

1. Keeps top-level nav compact
2. Familiar for static preferences

Weaknesses:

1. Poor fit for high-frequency planning workflow
2. Lower discoverability for first-time planning users
3. Conflates platform preferences with model-driving business inputs
4. Scales poorly as assumptions evolve into simulation controls and policy governance

### Option B

Top Level -> Financial Planning

Strengths:

1. Matches user intent: planning decisions, not account configuration
2. Improves discoverability of core differentiator
3. Supports clear workflow from assumptions to projections to decisions
4. Creates scalable foundation for AI coaching, Monte Carlo, tax optimization, and scenario comparison

Weaknesses:

1. Slightly higher top-nav complexity
2. Requires careful IA to avoid overlap with existing Goals and Cash Flow modules

### Evaluation by criteria

1. User workflow: Option B wins
2. Information architecture: Option B wins
3. Product scalability: Option B wins
4. Discoverability: Option B wins
5. User expectations: Option B wins for planning-centric personas
6. Navigation consistency: Option B wins if all forward-looking modules are grouped coherently
7. Long-term roadmap: Option B wins decisively

### Recommendation

Adopt Option B. Promote Financial Planning as a top-level module and define it as the source of truth for all projected outputs, recommendations, and future AI insights.

## Part 3 - New Top-Level Module Design

Proposed top-level module:

Financial Planning

1. Assumptions
2. Scenarios
3. Goals
4. Projections
5. What-if Analysis
6. Explainability
7. Insights (AI Coaching)

Detailed IA is provided in [FINANCIAL_PLANNING_INFORMATION_ARCHITECTURE.md](FINANCIAL_PLANNING_INFORMATION_ARCHITECTURE.md).

## Part 4 - Assumptions Redesign (Business-first)

Design principle: assumptions should be grouped by decision domain, not technical source tables.

### Proposed sections

1. Income
2. Investments
3. Investment Behavior
4. Loans
5. Inflation
6. Retirement
7. Tax and Compliance
8. Household and Lifecycle

### Recommended UX upgrades

1. Show per-field lineage: Effective value, source scope, inherited-from, last changed date.
2. Show runtime usage badge: Used in projection now vs Not used yet.
3. Add confidence/sensitivity indicator per field.
4. Add scenario impact preview before save.
5. Add assumption packs: Conservative, Balanced, Aggressive, Custom.
6. Add governance controls: draft, review, publish baseline.

## Part 5 - Scenario Planning Capability

Scenario catalog should include:

1. Conservative
2. Balanced
3. Aggressive
4. Early Retirement
5. Buy House
6. Child Education
7. International Education
8. Business Investment

For each scenario, support:

1. Purpose statement
2. Overridden input set
3. Projection horizon
4. Outcome deltas vs baseline
5. Decision recommendations

Detailed scenario design is provided in [FINANCIAL_PLANNING_INFORMATION_ARCHITECTURE.md](FINANCIAL_PLANNING_INFORMATION_ARCHITECTURE.md).

## Part 6 - Dedicated Projections Workspace

The Projections workspace should become the execution and comparison surface for:

1. Monthly horizon
2. Annual horizon
3. Retirement horizon
4. Age-based horizon
5. Net worth forecast
6. Cash flow forecast
7. Investment growth
8. Retirement corpus curve
9. Loan payoff timeline
10. Goal achievement timeline

Design goal: users should not need to jump between dashboard and debug viewer to understand planning outputs.

## Part 7 - Explainability-by-default

Every projected KPI should answer:

Why is this number what it is?

Trace chain design:

Current Data -> Assumptions Used -> Projection Formula -> Engine Step -> KPI Output

Explainability schema and page model are detailed in [FINANCIAL_PLANNING_INFORMATION_ARCHITECTURE.md](FINANCIAL_PLANNING_INFORMATION_ARCHITECTURE.md).

## Core Differentiator Architecture Principles

To ensure no future redesign is required for AI and advanced simulations:

1. Financial Planning becomes the orchestration layer for all deterministic and probabilistic runs.
2. All recommendation engines consume a shared Planning Context Contract.
3. All KPIs retain a machine-readable lineage payload.
4. Scenario comparison is a first-class primitive, not an ad hoc report.
5. Assumptions are versioned and auditable across time.
6. Monte Carlo, tax optimization, retirement strategies, and AI coaching plug into the same Planning Context Contract.

## Part 8 - Phased Implementation

See [FINANCIAL_PLANNING_IMPLEMENTATION_ROADMAP.md](FINANCIAL_PLANNING_IMPLEMENTATION_ROADMAP.md) for a detailed phase-by-phase plan.

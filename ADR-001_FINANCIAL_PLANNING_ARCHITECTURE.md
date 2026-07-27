# ADR-001: Financial Planning as Core Product Architecture

Status: Accepted  
Date: 2026-07-27  
Decision Owner: Project North Star Architecture Council  
Supersedes: None

## 1. Background

Project North Star has evolved from a financial tracking experience into a financial planning and decision-support platform. The product now supports planning-centric surfaces for assumptions, scenarios, goals, events, and projection outputs, while the Executive Dashboard consumes projected values for current-versus-planned comparisons.

As capabilities expanded, planning inputs and outcomes became central to user value creation:

1. Users set assumptions to define financial behavior expectations.
2. Users evaluate scenarios to compare futures.
3. Users review projected KPIs and recommendation outputs.
4. Users require explainability and trust for every projected number.

The current information architecture no longer cleanly reflects this reality.

## 2. Problem Statement

Planning Assumptions being represented under Settings no longer matches product vision or user workflow.

Why this is a problem:

1. Semantic mismatch: Settings implies low-frequency configuration, while assumptions are high-impact planning controls.
2. Workflow fragmentation: planning inputs and planning outcomes are distributed across routes, reducing clarity.
3. Discoverability risk: users may not locate or prioritize assumptions that drive projections and recommendations.
4. Scalability constraint: future capabilities (Monte Carlo, AI coaching, tax optimization) need a unified planning control center, not a nested settings page.

Therefore, the architecture must be realigned to the product's planning-first direction.

## 3. Decision

Financial Planning is established as a first-class top-level product module.

The module-level decision includes:

1. Financial Planning becomes the canonical orchestration layer for projected outcomes.
2. Planning Assumptions becomes the default landing page for the Financial Planning module.
3. Dashboard remains an outcome consumer of planning outputs, not the owner of planning logic.
4. Projection Engine remains calculation-only and decoupled from UI/presentation concerns.

Decision statement:

Project North Star will treat Financial Planning as the source-of-truth domain for assumptions, scenarios, projections, explainability, and forward-looking recommendations.

## 4. Scope

### 4.1 In scope for Financial Planning

Financial Planning owns all forward-looking orchestration and planning context surfaces, including:

1. Assumptions
2. Scenarios
3. Goals (planning context and feasibility)
4. Projections
5. What-if analysis
6. Explainability
7. Decision-support and AI insight entry points

Financial Planning is responsible for producing standardized planning outputs consumed by Dashboard, Reports, and recommendation layers.

### 4.2 In scope for Settings

Settings remains limited to account/system preferences and platform configuration, including:

1. Profile
2. Family profile metadata
3. Financial preferences (currency/year defaults)
4. System and integration preferences

Settings does not own assumptions, scenario policy, projection interpretation, or explainability.

## 5. Guiding Principles

The following principles govern architecture and product decisions under this ADR:

1. Every projection originates from Financial Planning.
2. Every projected KPI must be explainable end-to-end.
3. Dashboard is a consumer, not the owner, of projection logic.
4. Projection Engine remains calculation-only.
5. Assumptions are the single source of truth for forward-looking model inputs.
6. Business logic is separated from presentation.
7. Scenario comparison is a first-class capability, not an afterthought.
8. Planning outputs must be traceable, auditable, and reproducible.
9. Future intelligence (AI or optimization) must integrate through stable planning contracts.
10. UX should follow planning workflow: define -> simulate -> compare -> explain -> decide.

## 6. Future Expansion Compatibility

This ADR explicitly future-proofs the architecture for the following capabilities without requiring redesign:

1. Scenario families and branch comparisons
2. Monte Carlo simulation and probability bands
3. AI Coach and guided planning conversations
4. Tax planning and tax-aware strategy optimization
5. Retirement strategy planning and withdrawal path analysis
6. Estate and legacy planning
7. Goal optimization across competing priorities
8. Deep explainability and run lineage replay

Compatibility rule:

All new capabilities must consume a shared Planning Context Contract and emit standardized explainable outputs.

## 7. Migration Strategy

Migration must preserve existing behavior while incrementally shifting architecture ownership.

### 7.1 Migration objectives

1. No breakage of existing routes and workflows.
2. No forced projection engine redesign during architecture migration.
3. Clear progressive transition from settings-nested assumptions to planning-owned assumptions.

### 7.2 Route and UX transition strategy

1. Establish Financial Planning as top-level navigation entry.
2. Set Assumptions as default Financial Planning landing surface.
3. Keep existing planning routes functional during transition.
4. Preserve legacy/compatibility entry points under Settings using redirects or informational handoff until retirement.
5. Maintain canonical URL and ownership within Financial Planning.

### 7.3 Service and ownership transition strategy

1. Define explicit planning contracts for assumptions, runs, comparisons, and explainability.
2. Ensure dashboard and reports consume planning outputs through those contracts.
3. Keep projection calculation modules isolated from navigation and presentation concerns.
4. Introduce contract versioning to support future capability expansion.

### 7.4 Change management strategy

1. Publish architecture documentation and decision rationale to all stakeholders.
2. Align design, product, and engineering on section-level ownership boundaries.
3. Track adoption via planning workflow telemetry and KPI trace usage.

## 8. Success Criteria

Architecture is considered successfully implemented when all criteria are met:

### 8.1 Product and IA criteria

1. Financial Planning is top-level and discoverable in primary navigation.
2. Assumptions is the default Financial Planning landing page.
3. Settings no longer positions assumptions as primary settings content.

### 8.2 Workflow criteria

1. Users can complete planning workflow in one module: assumptions -> scenarios -> projections -> explainability.
2. Scenario comparison is accessible without route fragmentation.
3. Projection outcomes are consistently linked back to assumptions context.

### 8.3 Trust and explainability criteria

1. Every projected dashboard KPI exposes traceable lineage.
2. Users can identify which assumptions influenced each projected output.
3. Run metadata (scenario, horizon, as-of date) is explicit for projected views.

### 8.4 Architecture criteria

1. Projection engine remains calculation-only and UI-agnostic.
2. Business logic remains separated from presentation layers.
3. New intelligence capabilities integrate through planning contracts, without foundational IA redesign.

### 8.5 Adoption and outcome criteria

1. Increased engagement with assumptions and scenarios workflows.
2. Reduced confusion tickets around planned-vs-current interpretation.
3. Increased completion of scenario-to-decision journeys.

## 9. Consequences

### Positive consequences

1. Clearer product identity as planning and decision-support platform.
2. Better user trust through explainability-by-default architecture.
3. Scalable foundation for AI, Monte Carlo, and optimization capabilities.

### Trade-offs

1. Primary navigation becomes more planning-centric and potentially denser.
2. Migration requires careful continuity planning across legacy routes.
3. Teams must align around stricter domain ownership boundaries.

## 10. References

1. [FINANCIAL_PLANNING_MODULE_PROPOSAL.md](FINANCIAL_PLANNING_MODULE_PROPOSAL.md)
2. [FINANCIAL_PLANNING_INFORMATION_ARCHITECTURE.md](FINANCIAL_PLANNING_INFORMATION_ARCHITECTURE.md)
3. [FINANCIAL_PLANNING_IMPLEMENTATION_ROADMAP.md](FINANCIAL_PLANNING_IMPLEMENTATION_ROADMAP.md)

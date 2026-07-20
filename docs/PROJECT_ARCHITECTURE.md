# Project Architecture

## Overview
WealthOS is moving from record keeping into forward planning. Phase 2 introduces a Financial Projection Engine that sits beside the existing Financial Record Engine and derives monthly projections from the current state of the system.

The goal is architectural separation:
- the record engine stores and maintains facts
- the projection engine simulates possible futures
- the monthly review engine reconciles projections with reality
- the future AI decision engine will advise, explain, and scenario-test planning choices

## Financial Record Engine
The Financial Record Engine is the stable source of truth already in place.

It owns:
- CRUD for the financial modules
- validation and module-specific business rules
- imports and normalization
- dashboard, balance sheet, and operational summaries

Current modules include:
- Bank Accounts
- Investments
- Fixed Deposits
- Gold
- Silver
- Real Estate
- Retirement
- Liabilities

This layer must remain authoritative for actual balances and real-world transactions.

## Assumptions Engine
The Assumptions Engine is the configurable control panel for projection inputs.

It stores editable planning assumptions in the database so they can be changed without code changes and consumed consistently by the Projection Engine.

It is responsible for:
- income assumptions
- investment assumptions
- inflation assumptions
- loan assumptions
- retirement assumptions
- tax placeholders
- planning horizon settings

The initial scaffold is located in:
- [src/services/assumptions.ts](src/services/assumptions.ts)
- [src/types/assumptions.ts](src/types/assumptions.ts)
- [src/app/assumptions/page.tsx](src/app/assumptions/page.tsx)

## Projection Engine
The Projection Engine will simulate future months from a configurable start month through a planning horizon, with a default horizon of 2062.

It is responsible for:
- generating the monthly timeline
- loading opening balances from the record engine
- applying financial events
- applying growth assumptions
- applying loan amortization logic
- producing monthly projection snapshots
- running scenario-based projections

The engine should remain separate from CRUD and from actual-record persistence. It should consume the record engine as input, then generate derived outputs only.
It must read assumptions through the Assumptions Engine service boundary rather than reading configuration directly in the UI or projection layer.

The initial service scaffold is located in:
- [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts)

## Monthly Review Engine
The Monthly Review Engine compares projected values with actual values after a month closes.

It is responsible for:
- comparing projection vs actual
- calculating variance
- generating a monthly review result
- serving as the bridge that updates future projections when actuals change

The initial service scaffold is located in:
- [src/services/projection/MonthlyReviewService.ts](src/services/projection/MonthlyReviewService.ts)

## Future AI Decision Engine
The Future AI Decision Engine is intentionally not implemented in this phase.

Its future role will be to:
- explain why a projection changed
- suggest scenario adjustments
- compare planning options
- highlight monthly variance patterns
- support goal funding and retirement planning decisions

It should consume outputs from the record engine, projection engine, and monthly review engine rather than directly manipulating source records.

## Module Contracts
The projection layer is designed around typed contracts instead of direct business logic inside the UI.

Core types:
- FinancialAssumption
- FinancialEvent
- MonthlySnapshot
- MonthlyActual
- MonthlyVariance
- ProjectionScenario

These live in:
- [src/types/projection.ts](src/types/projection.ts)

## Interaction Model
The intended data flow is:

1. The Financial Record Engine stores actual balances, contributions, loans, and module updates.
2. The Projection Engine reads opening balances and assumptions from the record engine.
3. The Projection Engine generates month-by-month snapshots through the planning horizon.
4. The Monthly Review Engine compares projected snapshots to actual month-end values.
5. Variances feed back into updated future projections.
6. A future AI Decision Engine can then consume both the projected and actual history for explanation and scenario guidance.

## Planning Horizon
The default planning horizon is 2062, but the scenario contract should allow configurable horizons so future planning modes can support shorter or longer ranges without changing the engine contract.

## Implementation Boundary
Phase 2 is architecture only.

Do not implement business calculations yet. The placeholder services and type contracts define the shape of the system so future work can add calculations without disturbing the record engine.
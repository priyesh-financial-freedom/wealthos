# Financial Event Engine

The Financial Event Engine (FEE) is WealthOS's core execution platform for financial activities.

## Execution Pipeline

1. Generate events from source policies and system actions.
2. Validate required fields and business constraints.
3. Persist immutable events.
4. Schedule events with deterministic ordering.
5. Execute events through a handler registry.
6. Publish execution outcomes on the internal event bus.
7. Log execution audit records.

## Layering

- Repository: `EventRepository`
- Services: `EventGenerator`, `EventValidator`, `EventScheduler`, `EventExecutor`, `EventReplayService`, `EventHistoryService`, `EventBus`
- Orchestrator: `FinancialEventEngine`
- UI adapter: `EventDashboardService`

## Business Guarantees

- Immutable event records (no delete path in services).
- Idempotent execution for already executed events.
- Deterministic replay ordering.
- Full execution audit trail.
- Supabase-first persistence with RLS.

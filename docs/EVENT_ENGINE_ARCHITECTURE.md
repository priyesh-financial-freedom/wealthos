# Event Engine Architecture

```mermaid
flowchart LR
  A[Policy Sources] --> B[EventGenerator]
  B --> C[EventValidator]
  C --> D[EventRepository]
  D --> E[EventScheduler]
  E --> F[EventExecutor]
  F --> G[EventBus]
  F --> H[Execution Log]
  D --> I[EventHistoryService]
  D --> J[EventReplayService]
  K[Planning Events UI] --> L[EventDashboardService]
  L --> I
  L --> J
  M[FinancialEventEngine] --> B
  M --> C
  M --> D
  M --> E
  M --> F
  M --> G
```

## Notes

- React components consume only `EventDashboardService` APIs.
- Event computation and orchestration remain in services.
- Event execution handlers are pluggable through `EventExecutor`.

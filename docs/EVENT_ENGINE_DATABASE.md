# Event Engine Database Relationship Diagram

```mermaid
erDiagram
  FINANCIAL_EVENTS {
    uuid id PK
    uuid user_id FK
    text source_type
    text source_id
    text event_category
    text event_type
    text priority
    timestamptz scheduled_at
    timestamptz executed_at
    numeric amount
    text currency
    text status
    text correlation_id
    jsonb metadata
    timestamptz created_at
    timestamptz updated_at
  }

  FINANCIAL_EVENT_EXECUTION {
    uuid id PK
    uuid event_id FK
    timestamptz execution_start
    timestamptz execution_end
    int duration_ms
    jsonb result
    jsonb warnings
    text error_message
    int retry_count
  }

  FINANCIAL_EVENTS ||--o{ FINANCIAL_EVENT_EXECUTION : "has execution logs"
```

## Key Indexes

- `financial_events_user_scheduled_idx`
- `financial_events_status_idx`
- `financial_events_category_idx`
- `financial_events_source_idx`
- `financial_events_correlation_idx`
- `financial_event_execution_event_id_idx`

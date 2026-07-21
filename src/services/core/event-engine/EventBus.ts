import type { FinancialEvent } from "@/types/financialEvent";

export interface DomainEventPayload {
  type: "EVENT_EXECUTED" | "EVENT_FAILED";
  event: FinancialEvent;
  emittedAt: string;
  metadata: Record<string, unknown>;
}

type EventSubscriber = (payload: DomainEventPayload) => void | Promise<void>;

export class EventBus {
  private readonly subscribers = new Map<string, Set<EventSubscriber>>();

  subscribe(topic: string, subscriber: EventSubscriber): () => void {
    const existing = this.subscribers.get(topic) ?? new Set<EventSubscriber>();
    existing.add(subscriber);
    this.subscribers.set(topic, existing);

    return () => {
      const current = this.subscribers.get(topic);
      if (!current) {
        return;
      }
      current.delete(subscriber);
      if (current.size === 0) {
        this.subscribers.delete(topic);
      }
    };
  }

  async publish(topic: string, payload: DomainEventPayload): Promise<void> {
    const subscribers = this.subscribers.get(topic);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    for (const subscriber of subscribers) {
      await subscriber(payload);
    }
  }

  registerDefaultSubscribers() {
    this.subscribe("decision-engine", async () => undefined);
    this.subscribe("cash-flow-engine", async () => undefined);
    this.subscribe("snapshot-engine", async () => undefined);
    this.subscribe("ai-advisor", async () => undefined);
  }
}

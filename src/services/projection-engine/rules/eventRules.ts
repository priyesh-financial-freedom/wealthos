import { isFrequencyDue, isMonthWithinRange, monthsBetween } from "./month";
import type { FinancialRule } from "./contracts";

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export const retirementEventRule: FinancialRule = {
  id: "event.retirement",
  family: "event",
  step: "events",
  priority: 10,
  appliesTo: ({ context }) => {
    return context.events.some((event) => event.enabled && event.category === "Retirement");
  },
  execute: ({ context, monthKey, state }) => {
    const activeRetirement = context.events.some(
      (event) => event.enabled && event.category === "Retirement" && isMonthWithinRange({
        monthKey,
        startMonth: event.startMonth,
        endMonth: event.endMonth,
      }),
    );

    if (activeRetirement) {
      state.markRetired();
      state.recordNote("Retirement event active");
    }
  },
};

export const oneTimeExpenseEventRule: FinancialRule = {
  id: "event.one-time-expense",
  family: "event",
  step: "events",
  priority: 20,
  appliesTo: ({ context }) => {
    return context.events.some(
      (event) => event.enabled && (
        event.category === "One-Time Expense"
        || event.category === "Expense Event"
        || event.category === "Marriage"
        || event.category === "Education Expense"
      ),
    );
  },
  execute: ({ context, monthKey, state }) => {
    for (const event of context.events) {
      if (!event.enabled) {
        continue;
      }

      const categoryMatches =
        event.category === "Expense Event"
        || event.category === "Marriage"
        || event.category === "Education Expense"
        || event.category === "One-Time Expense";
      if (!categoryMatches) {
        continue;
      }

      if (!isMonthWithinRange({ monthKey, startMonth: event.startMonth, endMonth: event.endMonth })) {
        continue;
      }

      const monthIndexFromEffective = monthsBetween(event.effectiveMonth, monthKey);
      if (!isFrequencyDue({ monthIndexFromStart: monthIndexFromEffective, frequency: event.frequency })) {
        continue;
      }

      const amount = Math.max(0, toFiniteNumber(event.amount));
      state.addEventCashImpact(-amount);
      state.recordNote(`Event expense applied: ${event.name}`);
    }
  },
};

export const eventRules: readonly FinancialRule[] = [
  retirementEventRule,
  oneTimeExpenseEventRule,
];
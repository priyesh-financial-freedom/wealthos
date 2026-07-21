import type { FinancialEventFrequency, FinancialEventPriority } from "@/types/financialEvent";

export function parseDateOrThrow(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return parsed;
}

export function toIsoDateStart(value: string): string {
  const date = parseDateOrThrow(value);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function startOfMonthIso(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

export function endOfMonthIso(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

export function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function frequencyToStep(frequency: FinancialEventFrequency): { kind: "days" | "months"; amount: number } {
  switch (frequency) {
    case "DAILY":
      return { kind: "days", amount: 1 };
    case "WEEKLY":
      return { kind: "days", amount: 7 };
    case "MONTHLY":
      return { kind: "months", amount: 1 };
    case "QUARTERLY":
      return { kind: "months", amount: 3 };
    case "HALF_YEARLY":
      return { kind: "months", amount: 6 };
    case "YEARLY":
      return { kind: "months", amount: 12 };
    case "ONCE":
    default:
      return { kind: "days", amount: 0 };
  }
}

export function expandDates(params: { startDate: string; endDate: string; frequency: FinancialEventFrequency }): string[] {
  const start = parseDateOrThrow(params.startDate);
  const end = parseDateOrThrow(params.endDate);
  if (start.getTime() > end.getTime()) {
    return [];
  }

  if (params.frequency === "ONCE") {
    return [start.toISOString()];
  }

  const step = frequencyToStep(params.frequency);
  const dates: string[] = [];
  let cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString());
    cursor = step.kind === "days" ? addDays(cursor, step.amount) : addMonths(cursor, step.amount);
  }

  return dates;
}

const PRIORITY_WEIGHT: Record<FinancialEventPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function compareByDeterministicOrder(left: { priority: FinancialEventPriority; scheduledAt: string; createdAt?: string; id: string }, right: { priority: FinancialEventPriority; scheduledAt: string; createdAt?: string; id: string }): number {
  const priorityDiff = PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const scheduleDiff = left.scheduledAt.localeCompare(right.scheduledAt);
  if (scheduleDiff !== 0) {
    return scheduleDiff;
  }

  const createdDiff = (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return left.id.localeCompare(right.id);
}

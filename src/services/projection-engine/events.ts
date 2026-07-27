import { compareMonthKeys } from "./calendar";
import type { ProjectionEvent, ProjectionEventFrequency } from "./types";

export interface EventImpact {
  cashDelta: number;
  investmentsDelta: number;
  liabilitiesDelta: number;
  assetsDelta: number;
  notes: string[];
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isMonthInWindow(event: ProjectionEvent, monthKey: string): boolean {
  if (compareMonthKeys(monthKey, event.startMonth) < 0) {
    return false;
  }

  if (event.endMonth && compareMonthKeys(monthKey, event.endMonth) > 0) {
    return false;
  }

  return true;
}

function frequencyDue(frequency: ProjectionEventFrequency, monthIndexFromStart: number): boolean {
  if (monthIndexFromStart < 0) {
    return false;
  }

  if (frequency === "once") {
    return monthIndexFromStart === 0;
  }

  if (frequency === "monthly") {
    return true;
  }

  if (frequency === "quarterly") {
    return monthIndexFromStart % 3 === 0;
  }

  return monthIndexFromStart % 12 === 0;
}

function monthsBetween(startMonth: string, endMonth: string): number {
  const startParts = startMonth.split("-");
  const endParts = endMonth.split("-");
  const startYear = Number(startParts[0]);
  const start = Number(startParts[1]);
  const endYear = Number(endParts[0]);
  const end = Number(endParts[1]);

  return (endYear - startYear) * 12 + (end - start);
}

function eventEffect(event: ProjectionEvent): Omit<EventImpact, "notes"> {
  const amount = toFiniteNumber(event.amount);

  if (event.category === "Income Event") {
    return { cashDelta: amount, investmentsDelta: 0, liabilitiesDelta: 0, assetsDelta: 0 };
  }

  if (
    event.category === "Expense Event"
    || event.category === "Marriage"
    || event.category === "Education Expense"
  ) {
    return { cashDelta: -amount, investmentsDelta: 0, liabilitiesDelta: 0, assetsDelta: 0 };
  }

  if (event.category === "Asset Purchase" || event.category === "Property Purchase") {
    return {
      cashDelta: -amount,
      investmentsDelta: 0,
      liabilitiesDelta: 0,
      assetsDelta: amount,
    };
  }

  if (event.category === "Asset Sale" || event.category === "Property Sale") {
    return {
      cashDelta: amount,
      investmentsDelta: 0,
      liabilitiesDelta: 0,
      assetsDelta: -amount,
    };
  }

  if (event.category === "Loan Prepayment") {
    return {
      cashDelta: -amount,
      investmentsDelta: 0,
      liabilitiesDelta: -amount,
      assetsDelta: 0,
    };
  }

  return {
    cashDelta: 0,
    investmentsDelta: 0,
    liabilitiesDelta: 0,
    assetsDelta: 0,
  };
}

export function calculateMonthlyEventImpact(
  events: readonly ProjectionEvent[],
  monthKey: string,
): EventImpact {
  const impact: EventImpact = {
    cashDelta: 0,
    investmentsDelta: 0,
    liabilitiesDelta: 0,
    assetsDelta: 0,
    notes: [],
  };

  for (const event of events) {
    if (!event.enabled) {
      continue;
    }

    if (!isMonthInWindow(event, monthKey)) {
      continue;
    }

    const monthIndex = monthsBetween(event.effectiveMonth, monthKey);
    if (!frequencyDue(event.frequency, monthIndex)) {
      continue;
    }

    const effect = eventEffect(event);
    impact.cashDelta += effect.cashDelta;
    impact.investmentsDelta += effect.investmentsDelta;
    impact.liabilitiesDelta += effect.liabilitiesDelta;
    impact.assetsDelta += effect.assetsDelta;
    impact.notes.push(event.name);
  }

  return impact;
}
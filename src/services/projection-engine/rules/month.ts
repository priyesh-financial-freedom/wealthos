import { compareMonthKeys, parseMonthKey } from "../calendar";

export function isMonthWithinRange(input: {
  monthKey: string;
  startMonth: string;
  endMonth?: string;
}): boolean {
  if (compareMonthKeys(input.monthKey, input.startMonth) < 0) {
    return false;
  }

  if (input.endMonth && compareMonthKeys(input.monthKey, input.endMonth) > 0) {
    return false;
  }

  return true;
}

export function monthsBetween(startMonth: string, endMonth: string): number {
  const start = parseMonthKey(startMonth);
  const end = parseMonthKey(endMonth);
  return (end.year - start.year) * 12 + (end.month - start.month);
}

export function isFrequencyDue(input: {
  monthIndexFromStart: number;
  frequency: "once" | "monthly" | "quarterly" | "annual";
}): boolean {
  if (input.monthIndexFromStart < 0) {
    return false;
  }

  if (input.frequency === "once") {
    return input.monthIndexFromStart === 0;
  }

  if (input.frequency === "monthly") {
    return true;
  }

  if (input.frequency === "quarterly") {
    return input.monthIndexFromStart % 3 === 0;
  }

  return input.monthIndexFromStart % 12 === 0;
}
import type { ContributionRule } from "../types";

export function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function clampNonNegative(value: unknown): number {
  return Math.max(0, toFiniteNumber(value));
}

export function isValidMonthNumber(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 12;
}

export function isValidMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function contributionAmount(rule: ContributionRule | { amount?: number; percentage?: number }, income: number): number {
  const fixed = clampNonNegative(rule.amount);
  const percent = clampNonNegative(rule.percentage);

  if (fixed > 0) {
    return fixed;
  }

  if (percent > 0) {
    return income * (percent / 100);
  }

  return 0;
}

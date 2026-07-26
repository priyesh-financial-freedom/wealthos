import type { LoanType } from "./LoanTypes";

export interface MonthKey {
  year: number;
  month: number;
}

export function roundCurrency(value: number): number {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

export function parseMonthKey(monthKey: string): MonthKey {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

export function formatMonthKey(month: MonthKey): string {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

export function addMonths(monthKey: string, offset: number): string {
  const month = parseMonthKey(monthKey);
  const totalMonths = month.year * 12 + (month.month - 1) + offset;

  return formatMonthKey({
    year: Math.floor(totalMonths / 12),
    month: (totalMonths % 12) + 1,
  });
}

export function compareMonthKeys(left: string, right: string): number {
  const leftMonth = parseMonthKey(left);
  const rightMonth = parseMonthKey(right);

  if (leftMonth.year !== rightMonth.year) {
    return leftMonth.year - rightMonth.year;
  }

  return leftMonth.month - rightMonth.month;
}

export function monthlyInterestRate(annualInterestRate: number): number {
  const annualRate = Number(annualInterestRate ?? 0) / 100;

  if (!Number.isFinite(annualRate) || annualRate <= 0) {
    return 0;
  }

  return annualRate / 12;
}

export function calculateEmi(principal: number, monthlyRate: number, remainingMonths: number): number {
  const safePrincipal = Math.max(0, Number(principal ?? 0));
  const safeMonths = Math.max(1, Math.floor(Number(remainingMonths ?? 0)));

  if (safePrincipal === 0) {
    return 0;
  }

  if (monthlyRate <= 0) {
    return roundCurrency(safePrincipal / safeMonths);
  }

  const factor = Math.pow(1 + monthlyRate, safeMonths);
  return roundCurrency((safePrincipal * monthlyRate * factor) / (factor - 1));
}

export function clampToBalance(value: number, balance: number): number {
  return Math.max(0, Math.min(roundCurrency(value), roundCurrency(balance)));
}

export function isSupportedLoanType(value: string): value is LoanType {
  return value === "Home Loan" || value === "Car Loan" || value === "Personal Loan";
}

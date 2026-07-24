import type { ProjectionContext } from "@/services/projection/ProjectionContext";

export function annualCompoundedValue(baseAmount: number, annualRatePercent: number, monthIndex: number): number {
  const yearsElapsed = Math.floor(Math.max(0, monthIndex) / 12);
  const annualRate = Number(annualRatePercent ?? 0) / 100;

  if (!Number.isFinite(annualRate) || annualRate === 0 || yearsElapsed === 0) {
    return Number(baseAmount ?? 0);
  }

  return Number(baseAmount ?? 0) * Math.pow(1 + annualRate, yearsElapsed);
}

export function annualRateToMonthlyRate(annualRatePercent: number): number {
  const annualRate = Number(annualRatePercent ?? 0) / 100;
  if (!Number.isFinite(annualRate) || annualRate <= 0) {
    return 0;
  }

  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function getMonthNumber(monthKey: string): number {
  const [, monthText] = monthKey.split("-");
  const month = Number(monthText);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return month;
}

export function isSalaryActive(context: ProjectionContext): boolean {
  const [currentYearText, currentMonthText] = context.currentMonth.split("-");
  const currentYear = Number(currentYearText);
  const currentMonth = Number(currentMonthText);
  const stopYear = Number(context.assumptions.income.salaryStopYear ?? 0);
  const stopMonth = Number(context.assumptions.income.salaryStopMonth ?? 12);

  if (!Number.isInteger(currentYear) || !Number.isInteger(currentMonth) || !Number.isInteger(stopYear) || !Number.isInteger(stopMonth)) {
    return true;
  }

  if (currentYear < stopYear) {
    return true;
  }

  if (currentYear > stopYear) {
    return false;
  }

  return currentMonth <= stopMonth;
}

export function roundCurrency(value: number): number {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}
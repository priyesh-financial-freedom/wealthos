export type SalaryProjectionSource = "FIXED_LOCKED" | "ROLLING_REBASE";

export interface SalaryProjectionInput {
  startMonth: string;
  endMonth: string;
  currentGrossSalary: number;
  currentBasicSalary: number;
  annualIncrementPercent: number;
  incrementMonth?: number | null;
  retirementMonth?: string | null;
  source: SalaryProjectionSource;
}

export interface SalaryProjectionPoint {
  month_key: string;
  gross_salary: number;
  basic_salary: number;
  salary_growth_rate_used: number;
  is_salary_active: boolean;
  source: SalaryProjectionSource;
}

interface MonthStamp {
  year: number;
  month: number;
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMonthKey(monthKey: string): MonthStamp {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

function formatMonthKey(input: MonthStamp): string {
  return `${input.year}-${String(input.month).padStart(2, "0")}`;
}

function compareMonth(left: MonthStamp, right: MonthStamp): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return left.month - right.month;
}

function addMonth(input: MonthStamp): MonthStamp {
  if (input.month === 12) {
    return { year: input.year + 1, month: 1 };
  }

  return { year: input.year, month: input.month + 1 };
}

function normalizeIncrementMonth(start: MonthStamp, incrementMonth?: number | null): number {
  if (incrementMonth == null) {
    return start.month;
  }

  const normalized = Number(incrementMonth);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 12) {
    throw new Error("incrementMonth must be an integer between 1 and 12.");
  }

  return normalized;
}

function shouldApplyIncrement(cursor: MonthStamp, start: MonthStamp, incrementMonth: number): boolean {
  if (cursor.year === start.year && cursor.month === start.month) {
    return false;
  }

  return cursor.month === incrementMonth;
}

function isRetired(cursor: MonthStamp, retirement: MonthStamp | null): boolean {
  if (!retirement) {
    return false;
  }

  return compareMonth(cursor, retirement) >= 0;
}

function assertValidInput(input: SalaryProjectionInput): void {
  const gross = toFiniteNumber(input.currentGrossSalary);
  const basic = toFiniteNumber(input.currentBasicSalary);
  const increment = toFiniteNumber(input.annualIncrementPercent);

  if (!Number.isFinite(gross) || gross < 0) {
    throw new Error("currentGrossSalary must be a non-negative finite number.");
  }

  if (!Number.isFinite(basic) || basic < 0) {
    throw new Error("currentBasicSalary must be a non-negative finite number.");
  }

  if (!Number.isFinite(increment) || increment < 0) {
    throw new Error("annualIncrementPercent must be a non-negative finite number.");
  }

  if (basic > gross) {
    throw new Error("currentBasicSalary cannot be greater than currentGrossSalary.");
  }
}

export class SalaryProjectionService {
  buildMonthlyCurve(input: SalaryProjectionInput): SalaryProjectionPoint[] {
    assertValidInput(input);

    const start = parseMonthKey(input.startMonth);
    const end = parseMonthKey(input.endMonth);
    if (compareMonth(start, end) > 0) {
      throw new Error("endMonth must be greater than or equal to startMonth.");
    }

    const retirement = input.retirementMonth ? parseMonthKey(input.retirementMonth) : null;
    const incrementMonth = normalizeIncrementMonth(start, input.incrementMonth);
    const growthMultiplier = 1 + input.annualIncrementPercent / 100;

    let gross = roundCurrency(input.currentGrossSalary);
    let basic = roundCurrency(input.currentBasicSalary);
    let cursor = { ...start };
    const rows: SalaryProjectionPoint[] = [];

    while (compareMonth(cursor, end) <= 0) {
      const applyIncrement = shouldApplyIncrement(cursor, start, incrementMonth);
      if (applyIncrement) {
        gross = roundCurrency(gross * growthMultiplier);
        basic = roundCurrency(basic * growthMultiplier);
      }

      const salaryActive = !isRetired(cursor, retirement);

      rows.push({
        month_key: formatMonthKey(cursor),
        gross_salary: salaryActive ? gross : 0,
        basic_salary: salaryActive ? basic : 0,
        salary_growth_rate_used: input.annualIncrementPercent,
        is_salary_active: salaryActive,
        source: input.source,
      });

      cursor = addMonth(cursor);
    }

    return rows;
  }
}

export const salaryProjectionService = new SalaryProjectionService();

// TODO(phase-2): wire EPF/NPS/contribution processors to consume this curve instead of independent salary growth logic.

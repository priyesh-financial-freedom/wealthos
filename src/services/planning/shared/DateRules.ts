export type SharedFrequency = "monthly" | "quarterly" | "annual" | "one-time";

export interface YearMonth {
  year: number;
  month: number;
}

function normalizeMonthDate(value: string): string {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}$/.test(trimmed) ? `${trimmed}-01` : trimmed;
}

export function parseYearMonth(value: string): YearMonth | null {
  const normalized = normalizeMonthDate(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month };
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthSerial(input: YearMonth): number {
  return input.year * 12 + (input.month - 1);
}

export function compareMonths(left: YearMonth, right: YearMonth): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return left.month - right.month;
}

export function addMonths(input: YearMonth, offset = 1): YearMonth {
  const serial = monthSerial(input) + offset;
  return {
    year: Math.floor(serial / 12),
    month: (serial % 12) + 1,
  };
}

export function yearsElapsedByAnniversary(
  start: YearMonth,
  current: YearMonth,
  anniversaryMonthNumber: number | null,
): number {
  if (!anniversaryMonthNumber || anniversaryMonthNumber < 1 || anniversaryMonthNumber > 12) {
    return 0;
  }

  const startIndex = monthSerial(start);
  const currentIndex = monthSerial(current);

  let year = start.year;
  let marker = monthSerial({ year, month: anniversaryMonthNumber });

  if (marker <= startIndex) {
    year += 1;
    marker = monthSerial({ year, month: anniversaryMonthNumber });
  }

  let count = 0;
  while (marker <= currentIndex) {
    count += 1;
    year += 1;
    marker = monthSerial({ year, month: anniversaryMonthNumber });
  }

  return count;
}

export function isEffectiveForMonth(input: {
  isActive: boolean;
  effectiveDate: string;
  futureEffectiveDate: string | null;
  current: YearMonth;
}): boolean {
  if (!input.isActive) {
    return false;
  }

  const currentIndex = monthSerial(input.current);
  const effective = parseYearMonth(input.effectiveDate);
  const future = input.futureEffectiveDate ? parseYearMonth(input.futureEffectiveDate) : null;

  if (effective && currentIndex < monthSerial(effective)) {
    return false;
  }

  if (future && currentIndex < monthSerial(future)) {
    return false;
  }

  return true;
}

export function isMonthWithinWindow(input: {
  current: YearMonth;
  startDate: string | null;
  endDate: string | null;
}): boolean {
  const currentIndex = monthSerial(input.current);
  const start = input.startDate ? parseYearMonth(input.startDate) : null;
  const end = input.endDate ? parseYearMonth(input.endDate) : null;

  if (start && currentIndex < monthSerial(start)) {
    return false;
  }

  if (end && currentIndex > monthSerial(end)) {
    return false;
  }

  return true;
}

export function isFrequencyDue(input: {
  frequency: SharedFrequency;
  current: YearMonth;
  startDate?: string | null;
  anchorMonthNumber?: number | null;
}): boolean {
  if (input.frequency === "monthly") {
    return true;
  }

  if (input.frequency === "quarterly") {
    if (input.anchorMonthNumber && input.anchorMonthNumber >= 1 && input.anchorMonthNumber <= 12) {
      const offset = (input.current.month - input.anchorMonthNumber + 12) % 12;
      return offset % 3 === 0;
    }

    return input.current.month === 3 || input.current.month === 6 || input.current.month === 9 || input.current.month === 12;
  }

  if (input.frequency === "annual") {
    if (input.anchorMonthNumber && input.anchorMonthNumber >= 1 && input.anchorMonthNumber <= 12) {
      return input.current.month === input.anchorMonthNumber;
    }

    return input.current.month === 12;
  }

  if (!input.startDate) {
    return false;
  }

  const start = parseYearMonth(input.startDate);
  if (!start) {
    return false;
  }

  return compareMonths(input.current, start) === 0;
}

export function isSalaryIncrementMonth(currentMonth: number, incrementMonth: number | null): boolean {
  return incrementMonth !== null && currentMonth === incrementMonth;
}

export function isRetirementMonth(current: YearMonth, retirementStartDate: string | null): boolean {
  if (!retirementStartDate) {
    return false;
  }

  const retirement = parseYearMonth(retirementStartDate);
  if (!retirement) {
    return false;
  }

  return compareMonths(current, retirement) >= 0;
}

export function isGoalMonth(current: YearMonth, goalMonthKey: string | null): boolean {
  if (!goalMonthKey) {
    return false;
  }

  const goal = parseYearMonth(goalMonthKey);
  if (!goal) {
    return false;
  }

  return compareMonths(current, goal) === 0;
}

export function isLoanAnniversary(current: YearMonth, loanStartDate: string | null): boolean {
  if (!loanStartDate) {
    return false;
  }

  const start = parseYearMonth(loanStartDate);
  if (!start) {
    return false;
  }

  return current.month === start.month;
}

export function taxYearForMonth(year: number, month: number, taxYearStartMonth = 4): string {
  if (month >= taxYearStartMonth) {
    return `${year}-${year + 1}`;
  }

  return `${year - 1}-${year}`;
}

export function inflationYearIndex(start: YearMonth, current: YearMonth, escalationMonthNumber: number | null): number {
  return yearsElapsedByAnniversary(start, current, escalationMonthNumber);
}

interface YearMonth {
  year: number;
  month: number;
}

export function parseMonthKey(monthKey: string): YearMonth {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) {
    throw new Error(`Invalid month key: ${monthKey}. Expected YYYY-MM format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}. Expected YYYY-MM format.`);
  }

  return { year, month };
}

export function toMonthKey(value: YearMonth): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}`;
}

export function addMonths(monthKey: string, monthsToAdd: number): string {
  const parsed = parseMonthKey(monthKey);
  const total = parsed.year * 12 + (parsed.month - 1) + monthsToAdd;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;

  return toMonthKey({ year, month });
}

export function compareMonthKeys(leftMonthKey: string, rightMonthKey: string): number {
  const left = parseMonthKey(leftMonthKey);
  const right = parseMonthKey(rightMonthKey);
  const leftSerial = left.year * 12 + left.month;
  const rightSerial = right.year * 12 + right.month;

  if (leftSerial === rightSerial) {
    return 0;
  }

  return leftSerial < rightSerial ? -1 : 1;
}
export const MAX_FINANCIAL_ABS_VALUE_20_2 = 999999999999999999.99;
export const MAX_PERCENTAGE_ABS_VALUE_24_4 = 99999999999999999999.9999;

interface FinancialValidationOptions {
  roundToScale?: number;
  maxAbs?: number;
}

function roundToScale(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function assertValidFinancialNumber(
  value: unknown,
  fieldName: string,
  options: FinancialValidationOptions = {},
): number {
  if (typeof value !== "number") {
    throw new Error(`Invalid ${fieldName}: expected a number.`);
  }

  const numeric = value;
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid ${fieldName}: expected a finite numeric value.`);
  }

  const maxAbs = options.maxAbs ?? MAX_FINANCIAL_ABS_VALUE_20_2;
  if (Math.abs(numeric) > maxAbs) {
    throw new Error(`Invalid ${fieldName}: value exceeds supported range.`);
  }

  if (typeof options.roundToScale === "number") {
    return roundToScale(numeric, options.roundToScale);
  }

  return numeric;
}

export function assertValidNullableFinancialNumber(
  value: unknown,
  fieldName: string,
  options: FinancialValidationOptions = {},
): number | null {
  if (value === null) {
    return null;
  }

  return assertValidFinancialNumber(value, fieldName, options);
}
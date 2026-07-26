import type { TimelineGenerationInput, TimelineValidationIssue } from "./ProjectionMonth";
import { monthSerial, parseYearMonth } from "../shared";

export interface TimelineValidatorDependencies {
  maxSupportedMonths?: number;
}

const DEFAULT_MAX_SUPPORTED_MONTHS = 2400;

function monthDeltaInclusive(start: { year: number; month: number }, end: { year: number; month: number }): number {
  const delta = monthSerial(end) - monthSerial(start);
  return delta + 1;
}

function validateMonthNumber(
  value: number | null | undefined,
  field: string,
  issues: TimelineValidationIssue[],
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (!Number.isInteger(value) || value < 1 || value > 12) {
    issues.push({ field, message: "Expected a calendar month number between 1 and 12." });
  }
}

export class TimelineValidator {
  private readonly maxSupportedMonths: number;

  constructor(dependencies: TimelineValidatorDependencies = {}) {
    this.maxSupportedMonths = dependencies.maxSupportedMonths ?? DEFAULT_MAX_SUPPORTED_MONTHS;
  }

  validate(input: TimelineGenerationInput): TimelineValidationIssue[] {
    const issues: TimelineValidationIssue[] = [];

    const start = parseYearMonth(input.projectionStartDate);
    const end = parseYearMonth(input.projectionEndDate);

    if (!start) {
      issues.push({ field: "projectionStartDate", message: "Expected YYYY-MM or YYYY-MM-DD format." });
    }

    if (!end) {
      issues.push({ field: "projectionEndDate", message: "Expected YYYY-MM or YYYY-MM-DD format." });
    }

    if (start && end) {
      const spanMonths = monthDeltaInclusive(start, end);
      if (spanMonths <= 0) {
        issues.push({ field: "projectionEndDate", message: "Projection end date must be on or after projection start date." });
      }

      if (spanMonths > this.maxSupportedMonths) {
        issues.push({
          field: "projectionEndDate",
          message: `Projection span exceeds supported maximum of ${this.maxSupportedMonths} months.`,
        });
      }
    }

    const options = input.options;
    if (!options) {
      return issues;
    }

    if (options.ageAtProjectionStart !== null && options.ageAtProjectionStart !== undefined) {
      const age = Number(options.ageAtProjectionStart);
      if (!Number.isFinite(age) || age < 0) {
        issues.push({ field: "options.ageAtProjectionStart", message: "Expected a non-negative numeric age." });
      }
    }

    if (options.retirementAge !== null && options.retirementAge !== undefined) {
      const age = Number(options.retirementAge);
      if (!Number.isFinite(age) || age < 0) {
        issues.push({ field: "options.retirementAge", message: "Expected a non-negative numeric retirement age." });
      }
    }

    if (options.retirementStartDate) {
      const parsedRetirementStart = parseYearMonth(options.retirementStartDate);
      if (!parsedRetirementStart) {
        issues.push({ field: "options.retirementStartDate", message: "Expected YYYY-MM or YYYY-MM-DD format." });
      }
    }

    validateMonthNumber(options.salaryIncrementMonthNumber, "options.salaryIncrementMonthNumber", issues);
    validateMonthNumber(options.bonusMonthNumber, "options.bonusMonthNumber", issues);
    validateMonthNumber(options.financialYearStartMonth, "options.financialYearStartMonth", issues);
    validateMonthNumber(options.taxYearStartMonth, "options.taxYearStartMonth", issues);

    if (options.defaultInflationIndex !== null && options.defaultInflationIndex !== undefined) {
      const inflationIndex = Number(options.defaultInflationIndex);
      if (!Number.isFinite(inflationIndex)) {
        issues.push({ field: "options.defaultInflationIndex", message: "Expected a finite numeric inflation index." });
      }
    }

    return issues;
  }
}

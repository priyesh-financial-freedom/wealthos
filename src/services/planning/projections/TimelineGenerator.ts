import type {
  ProjectionMonth,
  ProjectionMonthKey,
  ProjectionTimelineEvent,
  TimelineGenerationInput,
  TimelineGenerationOptions,
  TimelineValidationIssue,
} from "./ProjectionMonth";
import { TimelineValidator } from "./TimelineValidator";
import {
  addMonths,
  compareMonths,
  deepFreeze,
  parseYearMonth,
  taxYearForMonth,
  toMonthKey,
} from "../shared";

interface TimelineGeneratorDependencies {
  validator?: TimelineValidator;
}

interface MonthCursor {
  monthNumber: number;
  year: number;
  month: number;
  monthKey: ProjectionMonthKey;
}

function toFiscalYear(year: number, month: number, fiscalYearStartMonth: number): string {
  return taxYearForMonth(year, month, fiscalYearStartMonth);
}

function parseOptionalMonth(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return parseYearMonth(value);
}

function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function cloneEvents(items: readonly ProjectionTimelineEvent[] | undefined): ProjectionTimelineEvent[] {
  return (items ?? []).map((item) => ({
    ...item,
    metadata: item.metadata ? { ...item.metadata } : undefined,
  }));
}

function normalizeOptions(options: TimelineGenerationOptions | undefined): Required<
  Pick<TimelineGenerationOptions, "financialYearStartMonth" | "taxYearStartMonth" | "defaultInflationIndex">
> & TimelineGenerationOptions {
  return {
    financialYearStartMonth: options?.financialYearStartMonth ?? 4,
    taxYearStartMonth: options?.taxYearStartMonth ?? 4,
    defaultInflationIndex: options?.defaultInflationIndex ?? null,
    ...options,
  };
}

function buildMonthCursors(start: { year: number; month: number }, end: { year: number; month: number }): MonthCursor[] {
  const cursors: MonthCursor[] = [];
  let current = { ...start };
  let counter = 1;

  while (compareMonths(current, end) <= 0) {
    cursors.push({
      monthNumber: counter,
      year: current.year,
      month: current.month,
      monthKey: toMonthKey(current.year, current.month) as ProjectionMonthKey,
    });
    current = addMonths(current);
    counter += 1;
  }

  return cursors;
}

export class TimelineGenerator {
  private readonly validator: TimelineValidator;

  constructor(dependencies: TimelineGeneratorDependencies = {}) {
    this.validator = dependencies.validator ?? new TimelineValidator();
  }

  generate(
    input: TimelineGenerationInput,
  ): { timeline: readonly ProjectionMonth[] | null; issues: TimelineValidationIssue[] } {
    const issues = this.validator.validate(input);
    if (issues.length > 0) {
      return { timeline: null, issues };
    }

    const start = parseYearMonth(input.projectionStartDate);
    const end = parseYearMonth(input.projectionEndDate);
    if (!start || !end) {
      return {
        timeline: null,
        issues: [{ field: "projectionStartDate", message: "Expected YYYY-MM or YYYY-MM-DD format." }],
      };
    }

    const options = normalizeOptions(input.options);
    const retirementStart = parseOptionalMonth(options.retirementStartDate);

    const months = buildMonthCursors(start, end).map((cursor) => {
      const inflationIndex = options.inflationIndexResolver
        ? options.inflationIndexResolver({
            monthKey: cursor.monthKey,
            monthNumber: cursor.monthNumber,
            year: cursor.year,
            month: cursor.month,
          })
        : options.defaultInflationIndex;

      const age = options.ageAtProjectionStart === null || options.ageAtProjectionStart === undefined
        ? null
        : round(Number(options.ageAtProjectionStart) + (cursor.monthNumber - 1) / 12);

      const retirementByDate = retirementStart
        ? compareMonths({ year: cursor.year, month: cursor.month }, retirementStart) >= 0
        : false;
      const retirementByAge = age !== null
        && options.retirementAge !== null
        && options.retirementAge !== undefined
        && age >= Number(options.retirementAge);
      const retirementFlag = retirementByDate || retirementByAge;

      const goalEvents = cloneEvents(options.goalEventResolver?.(cursor));
      const loanEvents = cloneEvents(options.loanEventResolver?.(cursor));
      const investmentEvents = cloneEvents(options.investmentEventResolver?.(cursor));

      const month: ProjectionMonth = {
        monthNumber: cursor.monthNumber,
        year: cursor.year,
        month: cursor.month,
        monthKey: cursor.monthKey,
        financialYear: toFiscalYear(cursor.year, cursor.month, options.financialYearStartMonth),
        age,
        retirementFlag,
        workingFlag: !retirementFlag,
        inflationIndex: inflationIndex === null || inflationIndex === undefined ? null : Number(inflationIndex),
        salaryIncrementMonth: options.salaryIncrementMonthNumber === cursor.month,
        bonusMonth: options.bonusMonthNumber === cursor.month,
        taxYear: taxYearForMonth(cursor.year, cursor.month, options.taxYearStartMonth),
        goalEvents,
        loanEvents,
        investmentEvents,
      };

      return deepFreeze(month);
    });

    return {
      timeline: deepFreeze(months.slice()),
      issues: [],
    };
  }
}

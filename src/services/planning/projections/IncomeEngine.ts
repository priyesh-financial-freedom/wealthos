import type { ProjectionContext } from "../projectionContext";
import type { EmploymentProfile, IncomeProfile, InflationAssumptions, RetirementProfile } from "../inputs";
import {
  formulaRegistry,
  inflationYearIndex,
  isEffectiveForMonth,
  isMonthWithinWindow,
  parseYearMonth,
  MoneyMath,
} from "../shared";

import type { ProjectionMonth } from "./ProjectionMonth";
import type { ProjectionState } from "./ProjectionState";
import type { MonthlyProcessorResult } from "./MonthlyProcessingPipeline";
import type { SimulationTrace } from "./SimulationTrace";

interface IncomeRules {
  salaryIncrementRateAnnual: number;
  salaryIncrementMonthNumber: number | null;
  bonusMonthNumber: number | null;
  rentalEscalationRateAnnual: number;
  rentalEscalationMonthNumber: number | null;
  consultingAnnual: number;
  consultingStartDate: string | null;
  consultingEndDate: string | null;
  dividendAnnual: number;
  interestAnnual: number;
}

export interface MonthlyIncomeResult {
  monthKey: string;
  salary: number;
  bonus: number;
  consulting: number;
  rental: number;
  dividend: number;
  interest: number;
  businessIncome: number;
  otherIncome: number;
  totalIncome: number;
  salaryIncrementApplied: boolean;
  workingFlag: boolean;
  retirementStopApplied: boolean;
  traces?: readonly SimulationTrace[];
}

export interface IncomeEngineProcessInput {
  projectionContext: ProjectionContext;
  currentMonth: ProjectionMonth;
  state: Readonly<ProjectionState>;
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableMonthNumber(value: unknown): number | null {
  const month = Number(value ?? NaN);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return month;
}


function readRules(
  incomeProfile: IncomeProfile,
  inflationAssumptions: InflationAssumptions | null,
): IncomeRules {
  const profileRecord = incomeProfile as unknown as Record<string, unknown>;

  const salaryIncrementRateAnnual = toNumber(
    profileRecord.salaryIncrementRateAnnual ?? inflationAssumptions?.generalInflationRate ?? 0,
  );
  const salaryIncrementMonthNumber = toNullableMonthNumber(profileRecord.salaryIncrementMonthNumber);
  const bonusMonthNumber = toNullableMonthNumber(profileRecord.bonusMonthNumber);

  const rentalEscalationRateAnnual = toNumber(
    profileRecord.rentalEscalationRateAnnual ?? inflationAssumptions?.propertyInflationRate ?? 0,
  );
  const rentalEscalationMonthNumber = toNullableMonthNumber(profileRecord.rentalEscalationMonthNumber);

  return {
    salaryIncrementRateAnnual,
    salaryIncrementMonthNumber,
    bonusMonthNumber,
    rentalEscalationRateAnnual,
    rentalEscalationMonthNumber,
    consultingAnnual: toNumber(profileRecord.consultingAnnual ?? 0),
    consultingStartDate: typeof profileRecord.consultingStartDate === "string" ? profileRecord.consultingStartDate : null,
    consultingEndDate: typeof profileRecord.consultingEndDate === "string" ? profileRecord.consultingEndDate : null,
    dividendAnnual: toNumber(profileRecord.dividendAnnual ?? 0),
    interestAnnual: toNumber(profileRecord.interestAnnual ?? 0),
  };
}

function isRetired(
  input: {
    currentMonth: ProjectionMonth;
    employmentProfile: EmploymentProfile | null;
    retirementProfile: RetirementProfile | null;
  },
): boolean {
  if (input.currentMonth.retirementFlag) {
    return true;
  }

  if (input.employmentProfile?.employmentStatus === "RETIRED") {
    return true;
  }

  const targetRetirementAge = toNumber(input.retirementProfile?.targetRetirementAge ?? NaN);
  if (input.currentMonth.age !== null && Number.isFinite(targetRetirementAge) && targetRetirementAge > 0) {
    return input.currentMonth.age >= targetRetirementAge;
  }

  return false;
}

export class IncomeEngine {
  calculate(input: {
    projectionContext: ProjectionContext;
    currentMonth: ProjectionMonth;
  }): MonthlyIncomeResult {
    const planningInputs = input.projectionContext.planningInputs;
    const incomeProfile = (planningInputs.IncomeProfile ?? null) as IncomeProfile | null;
    const employmentProfile = (planningInputs.EmploymentProfile ?? null) as EmploymentProfile | null;
    const retirementProfile = (planningInputs.RetirementProfile ?? null) as RetirementProfile | null;
    const inflationAssumptions = (planningInputs.InflationAssumptions ?? null) as InflationAssumptions | null;

    if (!incomeProfile) {
      return {
        monthKey: input.currentMonth.monthKey,
        salary: 0,
        bonus: 0,
        consulting: 0,
        rental: 0,
        dividend: 0,
        interest: 0,
        businessIncome: 0,
        otherIncome: 0,
        totalIncome: 0,
        salaryIncrementApplied: false,
        workingFlag: false,
        retirementStopApplied: true,
      };
    }

    const currentMonthParsed = parseYearMonth(input.currentMonth.monthKey);
    const projectionStartParsed = parseYearMonth(input.projectionContext.projectionStartDate);
    if (!currentMonthParsed || !projectionStartParsed) {
      throw new Error("IncomeEngine requires valid projection month keys.");
    }

    const rules = readRules(incomeProfile, inflationAssumptions);
    const retired = isRetired({
      currentMonth: input.currentMonth,
      employmentProfile,
      retirementProfile,
    });

    const incomeProfileActive = isEffectiveForMonth({
      isActive: incomeProfile.isActive,
      effectiveDate: incomeProfile.effectiveDate,
      futureEffectiveDate: incomeProfile.futureEffectiveDate,
      current: currentMonthParsed,
    });
    const workingFlag = incomeProfileActive && !retired;

    const salaryBaseMonthly = MoneyMath.annualToMonthly(incomeProfile.salaryAnnual ?? 0);
    const incrementsElapsed = inflationYearIndex(
      projectionStartParsed,
      currentMonthParsed,
      rules.salaryIncrementMonthNumber,
    );
    const salaryMultiplier = (1 + rules.salaryIncrementRateAnnual / 100) ** incrementsElapsed;
    const salary = workingFlag ? MoneyMath.multiply(salaryBaseMonthly, salaryMultiplier) : 0;

    const bonusMonthMatch = rules.bonusMonthNumber !== null
      ? input.currentMonth.month === rules.bonusMonthNumber
      : input.currentMonth.bonusMonth;
    const bonus = workingFlag && bonusMonthMatch
      ? MoneyMath.round(toNumber(incomeProfile.bonusAnnual ?? 0))
      : 0;

    const consultingActive = workingFlag
      && isMonthWithinWindow({
        current: currentMonthParsed,
        startDate: rules.consultingStartDate,
        endDate: rules.consultingEndDate,
      });
    const consulting = consultingActive ? MoneyMath.annualToMonthly(rules.consultingAnnual) : 0;

    const rentalBaseMonthly = MoneyMath.annualToMonthly(incomeProfile.rentalIncomeAnnual ?? 0);
    const rentalEscalationEvents = inflationYearIndex(
      projectionStartParsed,
      currentMonthParsed,
      rules.rentalEscalationMonthNumber,
    );
    const rentalMultiplier = (1 + rules.rentalEscalationRateAnnual / 100) ** rentalEscalationEvents;
    const rental = incomeProfileActive ? MoneyMath.multiply(rentalBaseMonthly, rentalMultiplier) : 0;

    const dividend = incomeProfileActive ? MoneyMath.annualToMonthly(rules.dividendAnnual) : 0;
    const interest = incomeProfileActive ? MoneyMath.annualToMonthly(rules.interestAnnual) : 0;
    const businessIncome = workingFlag ? MoneyMath.annualToMonthly(toNumber(incomeProfile.businessIncomeAnnual ?? 0)) : 0;
    const otherIncome = incomeProfileActive ? MoneyMath.annualToMonthly(toNumber(incomeProfile.otherIncomeAnnual ?? 0)) : 0;

    const totalIncome = MoneyMath.add(
      salary,
      bonus,
      consulting,
      rental,
      dividend,
      interest,
      businessIncome,
      otherIncome,
    );

    return {
      monthKey: input.currentMonth.monthKey,
      salary,
      bonus,
      consulting,
      rental,
      dividend,
      interest,
      businessIncome,
      otherIncome,
      totalIncome,
      salaryIncrementApplied: incrementsElapsed > 0 && input.currentMonth.salaryIncrementMonth,
      workingFlag,
      retirementStopApplied: retired,
      traces: [],
    };
  }

  process(input: IncomeEngineProcessInput): MonthlyProcessorResult {
    const result = this.calculate({
      projectionContext: input.projectionContext,
      currentMonth: input.currentMonth,
    });

    const nowIso = new Date().toISOString();

    const traces: SimulationTrace[] = [
      {
        ruleId: "income.salary.increment",
        formula: formulaRegistry.reference("INC-SALARY-ANNUAL-INCREMENT"),
        inputReferences: [
          "planningInputs.IncomeProfile.salaryAnnual",
          "planningInputs.IncomeProfile.salaryIncrementRateAnnual",
          "projectionContext.projectionStartDate",
          "currentMonth.monthKey",
        ],
        outputValues: { salary: result.salary },
        effectiveVersion: "v1",
        timestamp: nowIso,
        sourceModule: "IncomeEngine",
      },
      {
        ruleId: "income.bonus.month",
        formula: formulaRegistry.reference("INC-BONUS-MONTH"),
        inputReferences: [
          "planningInputs.IncomeProfile.bonusAnnual",
          "planningInputs.IncomeProfile.bonusMonthNumber",
          "currentMonth.month",
        ],
        outputValues: { bonus: result.bonus },
        effectiveVersion: "v1",
        timestamp: nowIso,
        sourceModule: "IncomeEngine",
      },
      {
        ruleId: "income.rental.escalation",
        formula: formulaRegistry.reference("INC-RENTAL-ESCALATION"),
        inputReferences: [
          "planningInputs.IncomeProfile.rentalIncomeAnnual",
          "planningInputs.IncomeProfile.rentalEscalationRateAnnual",
          "projectionContext.projectionStartDate",
          "currentMonth.monthKey",
        ],
        outputValues: { rental: result.rental },
        effectiveVersion: "v1",
        timestamp: nowIso,
        sourceModule: "IncomeEngine",
      },
    ];

    const nextState = {
      ...input.state,
      income: result.totalIncome,
      cash: MoneyMath.add(input.state.cash, result.totalIncome),
    };

    const withTraces: MonthlyIncomeResult = {
      ...result,
      traces,
    };

    return {
      state: {
        ...nextState,
      },
      traces: withTraces.traces,
    };
  }
}

export const incomeEngine = new IncomeEngine();

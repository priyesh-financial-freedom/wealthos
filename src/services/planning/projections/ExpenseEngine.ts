import type { ProjectionContext } from "../projectionContext";
import type {
  ExpenseProfile,
  InflationAssumptions,
  InsuranceAssumptions,
  RetirementProfile,
} from "../inputs";
import {
  formulaRegistry,
  inflationYearIndex,
  isEffectiveForMonth,
  isFrequencyDue,
  isMonthWithinWindow,
  parseYearMonth,
  MoneyMath,
} from "../shared";

import type { ProjectionMonth } from "./ProjectionMonth";
import type { ProjectionState } from "./ProjectionState";
import type { MonthlyProcessorResult } from "./MonthlyProcessingPipeline";
import type { SimulationTrace } from "./SimulationTrace";

type ExpenseFrequency = "monthly" | "quarterly" | "annual" | "one-time";

interface ScheduledExpenseItem {
  id: string;
  category:
    | "living"
    | "medical"
    | "travel"
    | "insurance"
    | "education"
    | "lifestyle"
    | "special"
    | "one-time"
    | "retirement";
  amount: number;
  frequency: ExpenseFrequency;
  startDate: string | null;
  endDate: string | null;
  monthNumber: number | null;
}

interface ExpenseRules {
  livingInflationRateAnnual: number;
  medicalInflationRateAnnual: number;
  travelInflationRateAnnual: number;
  educationInflationRateAnnual: number;
  lifestyleInflationRateAnnual: number;
  retirementExpenseRatio: number;
  escalationMonthNumber: number | null;
}

export interface MonthlyExpenseResult {
  monthKey: string;
  livingExpenses: number;
  medical: number;
  travel: number;
  insurance: number;
  education: number;
  lifestyle: number;
  inflation: number;
  specialEvents: number;
  oneTimeExpenses: number;
  retirementExpenses: number;
  totalExpenses: number;
  inflationApplied: boolean;
  retirementMode: boolean;
  traces?: readonly SimulationTrace[];
}

export interface ExpenseEngineProcessInput {
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


function resolveFrequency(value: unknown): ExpenseFrequency {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "monthly") {
    return "monthly";
  }

  if (normalized === "quarterly") {
    return "quarterly";
  }

  if (normalized === "annual" || normalized === "yearly") {
    return "annual";
  }

  if (normalized === "one-time" || normalized === "once") {
    return "one-time";
  }

  return "monthly";
}

function shouldApplyFrequency(item: ScheduledExpenseItem, currentMonth: ProjectionMonth): boolean {
  return isFrequencyDue({
    frequency: item.frequency,
    current: { year: currentMonth.year, month: currentMonth.month },
    startDate: item.startDate,
    anchorMonthNumber: item.monthNumber,
  });
}

function readRules(
  inflationAssumptions: InflationAssumptions | null,
  retirementProfile: RetirementProfile | null,
  expenseProfile: ExpenseProfile,
): ExpenseRules {
  const expenseRecord = expenseProfile as unknown as Record<string, unknown>;

  return {
    livingInflationRateAnnual: toNumber(
      expenseRecord.livingInflationRateAnnual ?? inflationAssumptions?.generalInflationRate ?? 0,
    ),
    medicalInflationRateAnnual: toNumber(
      expenseRecord.medicalInflationRateAnnual ?? inflationAssumptions?.healthcareInflationRate ?? 0,
    ),
    travelInflationRateAnnual: toNumber(
      expenseRecord.travelInflationRateAnnual ?? inflationAssumptions?.generalInflationRate ?? 0,
    ),
    educationInflationRateAnnual: toNumber(
      expenseRecord.educationInflationRateAnnual ?? inflationAssumptions?.educationInflationRate ?? 0,
    ),
    lifestyleInflationRateAnnual: toNumber(
      expenseRecord.lifestyleInflationRateAnnual ?? inflationAssumptions?.lifestyleInflationRate ?? 0,
    ),
    retirementExpenseRatio: toNumber(retirementProfile?.retirementExpenseRatio ?? expenseRecord.retirementExpenseRatio ?? 0),
    escalationMonthNumber: toNullableMonthNumber(expenseRecord.expenseEscalationMonthNumber),
  };
}

function yearlyEscalated(baseMonthly: number, annualRate: number, escalationsElapsed: number): number {
  const multiplier = (1 + annualRate / 100) ** escalationsElapsed;
  return MoneyMath.multiply(baseMonthly, multiplier);
}

function extractScheduledItems(
  projectionContext: ProjectionContext,
): ScheduledExpenseItem[] {
  const items: ScheduledExpenseItem[] = [];
  const events = projectionContext.events ?? [];

  for (const event of events) {
    if (event.module !== "cash-flow") {
      continue;
    }

    const meta = event.metadata ?? {};
    const expenseCategory = String(meta.expenseCategory ?? "special").toLowerCase();
    const category: ScheduledExpenseItem["category"] =
      expenseCategory === "one-time" || expenseCategory === "one_time"
        ? "one-time"
        : "special";

    items.push({
      id: event.id,
      category,
      amount: toNumber(event.amount ?? 0),
      frequency: resolveFrequency(event.frequency),
      startDate: event.startsOn ?? event.date ?? null,
      endDate: event.endsOn ?? null,
      monthNumber: toNullableMonthNumber(meta.monthNumber),
    });
  }

  return items;
}

function isRetirementMode(
  currentMonth: ProjectionMonth,
  retirementProfile: RetirementProfile | null,
): boolean {
  if (currentMonth.retirementFlag) {
    return true;
  }

  const targetRetirementAge = toNumber(retirementProfile?.targetRetirementAge ?? NaN);
  if (currentMonth.age !== null && Number.isFinite(targetRetirementAge) && targetRetirementAge > 0) {
    return currentMonth.age >= targetRetirementAge;
  }

  return false;
}

export class ExpenseEngine {
  calculate(input: {
    projectionContext: ProjectionContext;
    currentMonth: ProjectionMonth;
  }): MonthlyExpenseResult {
    const planningInputs = input.projectionContext.planningInputs;
    const expenseProfile = (planningInputs.ExpenseProfile ?? null) as ExpenseProfile | null;
    const inflationAssumptions = (planningInputs.InflationAssumptions ?? null) as InflationAssumptions | null;
    const insuranceAssumptions = (planningInputs.InsuranceAssumptions ?? null) as InsuranceAssumptions | null;
    const retirementProfile = (planningInputs.RetirementProfile ?? null) as RetirementProfile | null;

    if (!expenseProfile) {
      return {
        monthKey: input.currentMonth.monthKey,
        livingExpenses: 0,
        medical: 0,
        travel: 0,
        insurance: 0,
        education: 0,
        lifestyle: 0,
        inflation: 0,
        specialEvents: 0,
        oneTimeExpenses: 0,
        retirementExpenses: 0,
        totalExpenses: 0,
        inflationApplied: false,
        retirementMode: input.currentMonth.retirementFlag,
      };
    }

    const currentMonthParsed = parseYearMonth(input.currentMonth.monthKey);
    const projectionStartParsed = parseYearMonth(input.projectionContext.projectionStartDate);
    if (!currentMonthParsed || !projectionStartParsed) {
      throw new Error("ExpenseEngine requires valid projection month keys.");
    }

    const profileActive = isEffectiveForMonth({
      isActive: expenseProfile.isActive,
      effectiveDate: expenseProfile.effectiveDate,
      futureEffectiveDate: expenseProfile.futureEffectiveDate,
      current: currentMonthParsed,
    });
    const inflationActive = inflationAssumptions
      ? isEffectiveForMonth({
        isActive: inflationAssumptions.isActive,
        effectiveDate: inflationAssumptions.effectiveDate,
        futureEffectiveDate: inflationAssumptions.futureEffectiveDate,
        current: currentMonthParsed,
      })
      : false;
    const retirementActive = retirementProfile
      ? isEffectiveForMonth({
        isActive: retirementProfile.isActive,
        effectiveDate: retirementProfile.effectiveDate,
        futureEffectiveDate: retirementProfile.futureEffectiveDate,
        current: currentMonthParsed,
      })
      : false;
    const insuranceActive = insuranceAssumptions
      ? isEffectiveForMonth({
        isActive: insuranceAssumptions.isActive,
        effectiveDate: insuranceAssumptions.effectiveDate,
        futureEffectiveDate: insuranceAssumptions.futureEffectiveDate,
        current: currentMonthParsed,
      })
      : false;

    const rules = readRules(
      inflationActive ? inflationAssumptions : null,
      retirementActive ? retirementProfile : null,
      expenseProfile,
    );

    const escalations = inflationYearIndex(
      projectionStartParsed,
      currentMonthParsed,
      rules.escalationMonthNumber,
    );

    const baseLiving = MoneyMath.annualToMonthly(expenseProfile.essentialExpenseAnnual ?? 0);
    const baseLifestyle = MoneyMath.annualToMonthly(expenseProfile.discretionaryExpenseAnnual ?? 0);
    const baseEducation = MoneyMath.annualToMonthly(expenseProfile.educationExpenseAnnual ?? 0);
    const baseMedical = MoneyMath.annualToMonthly(expenseProfile.healthcareExpenseAnnual ?? 0);
    const baseTravel = MoneyMath.annualToMonthly((expenseProfile as unknown as Record<string, unknown>).travelExpenseAnnual ?? 0);

    const livingExpenses = profileActive
      ? yearlyEscalated(baseLiving, rules.livingInflationRateAnnual, escalations)
      : 0;
    const medical = profileActive
      ? yearlyEscalated(baseMedical, rules.medicalInflationRateAnnual, escalations)
      : 0;
    const travel = profileActive
      ? yearlyEscalated(baseTravel, rules.travelInflationRateAnnual, escalations)
      : 0;
    const education = profileActive
      ? yearlyEscalated(baseEducation, rules.educationInflationRateAnnual, escalations)
      : 0;
    const lifestyle = profileActive
      ? yearlyEscalated(baseLifestyle, rules.lifestyleInflationRateAnnual, escalations)
      : 0;

    const insurance = insuranceActive
      ? MoneyMath.annualToMonthly(toNumber(insuranceAssumptions?.annualInsurancePremium ?? 0))
      : 0;

    const retirementMode = isRetirementMode(input.currentMonth, retirementActive ? retirementProfile : null);
    const preRetirementSubtotal = MoneyMath.add(livingExpenses, medical, travel, insurance, education, lifestyle);
    const retirementExpenses = retirementMode && rules.retirementExpenseRatio > 0
      ? MoneyMath.multiply(preRetirementSubtotal, rules.retirementExpenseRatio / 100)
      : 0;

    const scheduledItems = extractScheduledItems(input.projectionContext);
    let specialEvents = 0;
    let oneTimeExpenses = 0;
    for (const item of scheduledItems) {
      if (!isMonthWithinWindow({ current: currentMonthParsed, startDate: item.startDate, endDate: item.endDate })) {
        continue;
      }

      if (!shouldApplyFrequency(item, input.currentMonth)) {
        continue;
      }

      if (item.category === "one-time") {
        oneTimeExpenses += item.amount;
      } else {
        specialEvents += item.amount;
      }
    }

    specialEvents = MoneyMath.round(specialEvents);
    oneTimeExpenses = MoneyMath.round(oneTimeExpenses);

    const totalExpenses = MoneyMath.add(
      preRetirementSubtotal,
      retirementExpenses,
      specialEvents,
      oneTimeExpenses,
    );

    const inflationDelta = MoneyMath.round(
      (livingExpenses - MoneyMath.round(baseLiving))
      + (medical - MoneyMath.round(baseMedical))
      + (travel - MoneyMath.round(baseTravel))
      + (education - MoneyMath.round(baseEducation))
      + (lifestyle - MoneyMath.round(baseLifestyle)),
    );

    return {
      monthKey: input.currentMonth.monthKey,
      livingExpenses,
      medical,
      travel,
      insurance,
      education,
      lifestyle,
      inflation: Math.max(0, inflationDelta),
      specialEvents,
      oneTimeExpenses,
      retirementExpenses,
      totalExpenses,
      inflationApplied: escalations > 0,
      retirementMode,
      traces: [],
    };
  }

  process(input: ExpenseEngineProcessInput): MonthlyProcessorResult {
    const result = this.calculate({
      projectionContext: input.projectionContext,
      currentMonth: input.currentMonth,
    });

    const nowIso = new Date().toISOString();

    const traces: SimulationTrace[] = [
      {
        ruleId: "expense.inflation.escalation",
        formula: formulaRegistry.reference("EXP-INFLATION-ESCALATION"),
        inputReferences: [
          "planningInputs.ExpenseProfile",
          "planningInputs.InflationAssumptions",
          "projectionContext.projectionStartDate",
          "currentMonth.monthKey",
        ],
        outputValues: {
          livingExpenses: result.livingExpenses,
          medical: result.medical,
          travel: result.travel,
          education: result.education,
          lifestyle: result.lifestyle,
        },
        effectiveVersion: "v1",
        timestamp: nowIso,
        sourceModule: "ExpenseEngine",
      },
      {
        ruleId: "expense.frequency.schedule",
        formula: formulaRegistry.reference("EXP-FREQUENCY-SCHEDULE"),
        inputReferences: ["projectionContext.events", "currentMonth.month", "currentMonth.monthKey"],
        outputValues: {
          specialEvents: result.specialEvents,
          oneTimeExpenses: result.oneTimeExpenses,
        },
        effectiveVersion: "v1",
        timestamp: nowIso,
        sourceModule: "ExpenseEngine",
      },
      {
        ruleId: "expense.retirement.ratio",
        formula: formulaRegistry.reference("EXP-RETIREMENT-RATIO"),
        inputReferences: [
          "planningInputs.RetirementProfile.retirementExpenseRatio",
          "currentMonth.retirementFlag",
        ],
        outputValues: {
          retirementExpenses: result.retirementExpenses,
        },
        effectiveVersion: "v1",
        timestamp: nowIso,
        sourceModule: "ExpenseEngine",
      },
    ];

    const nextState = {
      ...input.state,
      expenses: result.totalExpenses,
      cash: MoneyMath.subtract(input.state.cash, result.totalExpenses),
    };

    const withTraces: MonthlyExpenseResult = {
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

export const expenseEngine = new ExpenseEngine();

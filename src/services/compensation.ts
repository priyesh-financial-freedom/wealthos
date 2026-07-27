import { assumptionsService } from "@/services/assumptions";
import { DEFAULT_PROJECTION_SCENARIO_KEY, projectionEventsService } from "@/services/projection";
import type { AssumptionsBundle } from "@/types/assumptions";
import type { FinancialEvent } from "@/types/projection";

export interface CompensationProfile {
  employer: string;
  grossSalaryPerMonth: number;
  effectiveMonth: string;
  annualIncrementPercent: number;
  incrementMonth: number;
  basicPercentOfGross: number;
  employeePfPercent: number;
  vpfPercent: number;
  employerEpfPercent: number;
  professionalTax: number;
  incomeTaxPercent: number;
  currentNps: number;
  annualBonus: number;
  bonusMonth: number;
}

export interface CompensationSummary {
  profile: CompensationProfile;
  basicSalary: number;
  employeePf: number;
  vpf: number;
  employerEpf: number;
  professionalTax: number;
  incomeTax: number;
  nps: number;
  netMonthlySalary: number;
  monthlyBonusEquivalent: number;
  annualGross: number;
  annualFixedCompensation: number;
}

interface CompensationMetadata {
  entryKind?: string;
  compensationProfile?: Partial<CompensationProfile>;
}

const COMPENSATION_ENTRY_KIND = "compensation-profile";

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, toNumber(value)));
}

function clampMonthNumber(value: number): number {
  const rounded = Math.round(toNumber(value));
  return Math.max(1, Math.min(12, rounded));
}

function normalizeMonthKey(value: string | null | undefined): string {
  const fallback = new Date().toISOString().slice(0, 7);
  const input = String(value ?? "").trim();
  return /^\d{4}-\d{2}$/.test(input) ? input : fallback;
}

function metadataFor(event: FinancialEvent): CompensationMetadata {
  return (event.metadata ?? {}) as CompensationMetadata;
}

function isCompensationProfileEvent(event: FinancialEvent): boolean {
  if (event.module !== "cash-flow" || event.type !== "cash-flow") {
    return false;
  }

  return metadataFor(event).entryKind === COMPENSATION_ENTRY_KIND;
}

function normalizeProfile(profile: Partial<CompensationProfile> | null | undefined): CompensationProfile {
  const source = profile ?? {};

  return {
    employer: String(source.employer ?? "").trim(),
    grossSalaryPerMonth: roundTwo(Math.max(0, toNumber(source.grossSalaryPerMonth))),
    effectiveMonth: normalizeMonthKey(source.effectiveMonth),
    annualIncrementPercent: clampPercent(toNumber(source.annualIncrementPercent)),
    incrementMonth: clampMonthNumber(toNumber(source.incrementMonth ?? 4)),
    basicPercentOfGross: clampPercent(toNumber(source.basicPercentOfGross ?? 40)),
    employeePfPercent: clampPercent(toNumber(source.employeePfPercent ?? 12)),
    vpfPercent: clampPercent(toNumber(source.vpfPercent ?? 0)),
    employerEpfPercent: clampPercent(toNumber(source.employerEpfPercent ?? 12)),
    professionalTax: roundTwo(Math.max(0, toNumber(source.professionalTax))),
    incomeTaxPercent: clampPercent(toNumber(source.incomeTaxPercent ?? 0)),
    currentNps: roundTwo(Math.max(0, toNumber(source.currentNps))),
    annualBonus: roundTwo(Math.max(0, toNumber(source.annualBonus))),
    bonusMonth: clampMonthNumber(toNumber(source.bonusMonth ?? 3)),
  };
}

function buildSummaryFromProfile(profile: CompensationProfile): CompensationSummary {
  const basicSalary = roundTwo(profile.grossSalaryPerMonth * (profile.basicPercentOfGross / 100));
  const employeePf = roundTwo(basicSalary * (profile.employeePfPercent / 100));
  const vpf = roundTwo(basicSalary * (profile.vpfPercent / 100));
  const employerEpf = roundTwo(basicSalary * (profile.employerEpfPercent / 100));
  const professionalTax = roundTwo(Math.max(0, profile.professionalTax));
  const incomeTax = roundTwo(profile.grossSalaryPerMonth * (profile.incomeTaxPercent / 100));
  const nps = roundTwo(Math.max(0, profile.currentNps));
  const deductions = employeePf + vpf + professionalTax + incomeTax + nps;
  const netMonthlySalary = roundTwo(Math.max(0, profile.grossSalaryPerMonth - deductions));
  const monthlyBonusEquivalent = roundTwo(profile.annualBonus / 12);
  const annualFixedCompensation = roundTwo(profile.grossSalaryPerMonth * 12);
  const annualGross = roundTwo(annualFixedCompensation + profile.annualBonus);

  return {
    profile,
    basicSalary,
    employeePf,
    vpf,
    employerEpf,
    professionalTax,
    incomeTax,
    nps,
    netMonthlySalary,
    monthlyBonusEquivalent,
    annualGross,
    annualFixedCompensation,
  };
}

function profileEventPayload(profile: CompensationProfile, scenarioKey: string) {
  const asOfDate = `${profile.effectiveMonth}-01`;

  return {
    scenarioKey,
    module: "cash-flow" as const,
    type: "cash-flow" as const,
    name: "Compensation Profile",
    amount: profile.grossSalaryPerMonth,
    date: asOfDate,
    frequency: "monthly" as const,
    repeatEveryMonths: 1,
    startsOn: asOfDate,
    endsOn: null,
    isEnabled: true,
    metadata: {
      entryKind: COMPENSATION_ENTRY_KIND,
      compensationProfile: profile,
    },
  };
}

function applyCompensationToBundle(bundle: AssumptionsBundle, summary: CompensationSummary): AssumptionsBundle {
  const monthlyIncome = summary.netMonthlySalary;
  const employeeAndVpfRate = monthlyIncome > 0 ? (summary.employeePf + summary.vpf) / monthlyIncome * 100 : 0;
  const employerEpfRate = monthlyIncome > 0 ? summary.employerEpf / monthlyIncome * 100 : 0;
  const npsRate = monthlyIncome > 0 ? summary.nps / monthlyIncome * 100 : 0;

  return {
    ...bundle,
    income: {
      ...bundle.income,
      monthlyIncome,
      annualIncrementRate: summary.profile.annualIncrementPercent,
      salaryGrowthRate: summary.profile.annualIncrementPercent,
      bonusAmount: summary.profile.annualBonus,
      bonusMonth: summary.profile.bonusMonth,
    },
    retirement: {
      ...bundle.retirement,
      epfEmployeeContributionRate: roundTwo(employeeAndVpfRate),
      epfEmployerContributionRate: roundTwo(employerEpfRate),
      npsContributionRate: roundTwo(npsRate),
    },
    tax: {
      ...bundle.tax,
      effectiveTaxRate: summary.profile.incomeTaxPercent,
    },
  };
}

export class CompensationService {
  async getProfile(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<CompensationProfile | null> {
    const events = await projectionEventsService.listEvents(scenarioKey);
    const match = [...events].reverse().find(isCompensationProfileEvent) ?? null;
    if (!match) {
      return null;
    }

    const profile = metadataFor(match).compensationProfile;
    return normalizeProfile(profile);
  }

  async upsertProfile(input: Partial<CompensationProfile>, scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<CompensationProfile> {
    const nextProfile = normalizeProfile(input);
    const events = await projectionEventsService.listEvents(scenarioKey);
    const existing = [...events].reverse().find(isCompensationProfileEvent) ?? null;

    if (!existing) {
      await projectionEventsService.createEvent(profileEventPayload(nextProfile, scenarioKey));
      return nextProfile;
    }

    await projectionEventsService.updateEvent({
      id: existing.id,
      ...profileEventPayload(nextProfile, scenarioKey),
    });

    return nextProfile;
  }

  async getSummary(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<CompensationSummary | null> {
    const profile = await this.getProfile(scenarioKey);
    if (!profile) {
      return null;
    }

    return buildSummaryFromProfile(profile);
  }

  async getCompensatedAssumptionsBundle(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<AssumptionsBundle> {
    const [bundle, summary] = await Promise.all([
      assumptionsService.getAssumptionsBundle(scenarioKey),
      this.getSummary(scenarioKey).catch(() => null),
    ]);

    if (!summary) {
      return bundle;
    }

    return applyCompensationToBundle(bundle, summary);
  }

  buildSummaryFromProfile(profile: CompensationProfile): CompensationSummary {
    return buildSummaryFromProfile(normalizeProfile(profile));
  }
}

export const compensationService = new CompensationService();

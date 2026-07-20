import type { AssumptionsBundle } from "@/types/assumptions";
import type { FinancialEvent, ProjectionEventType, ProjectionBalanceState } from "@/types/projection";
import type { EventEffect, EventProcessorContext, FinancialEventProcessor } from "@/services/projection/EventEngine";

const GROWTH_EVENT_TYPES: ProjectionEventType[] = [
  "mutual-fund-growth",
  "stock-growth",
  "fixed-deposit-growth",
  "epf-growth",
  "ppf-growth",
  "nps-growth",
  "gold-appreciation",
  "silver-appreciation",
  "real-estate-appreciation",
];

type GrowthTarget = "cash" | "investments" | "retirement" | "assets" | "liabilities";

function parseMonth(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

function monthDate(monthKey: string) {
  const { year, month } = parseMonth(monthKey);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function annualRateToMonthlyRate(annualRatePercent: number): number {
  const annualRate = Number(annualRatePercent ?? 0) / 100;
  if (annualRate <= 0) {
    return 0;
  }

  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

function clampShare(value: unknown): number {
  const share = Number(value ?? 1);
  if (!Number.isFinite(share) || share <= 0) {
    return 1;
  }

  return Math.min(1, share);
}

function targetField(target: GrowthTarget): keyof ProjectionBalanceState {
  switch (target) {
    case "cash":
      return "cash";
    case "retirement":
      return "retirement";
    case "liabilities":
      return "liabilities";
    case "assets":
      return "assets";
    case "investments":
    default:
      return "investments";
  }
}

function inferTargetFromEventType(eventType: ProjectionEventType): GrowthTarget {
  if (eventType === "epf-growth" || eventType === "ppf-growth" || eventType === "nps-growth") {
    return "retirement";
  }

  if (eventType === "gold-appreciation" || eventType === "silver-appreciation" || eventType === "real-estate-appreciation") {
    return "assets";
  }

  return "investments";
}

function resolveGrowthTarget(event: FinancialEvent): GrowthTarget {
  const metadataTarget = event.metadata?.growthTarget;
  if (metadataTarget === "cash" || metadataTarget === "investments" || metadataTarget === "retirement" || metadataTarget === "assets" || metadataTarget === "liabilities") {
    return metadataTarget;
  }

  return inferTargetFromEventType(event.type);
}

function resolveAnnualRate(event: FinancialEvent): number {
  const metadataAnnualRate = Number(event.metadata?.annualRate ?? NaN);
  if (Number.isFinite(metadataAnnualRate)) {
    return metadataAnnualRate;
  }

  const amountAsRate = Number(event.amount ?? 0);
  return Number.isFinite(amountAsRate) ? amountAsRate : 0;
}

function buildGrowthEffect(context: EventProcessorContext): EventEffect {
  const event = context.event;
  const annualRatePercent = resolveAnnualRate(event);
  const monthlyRate = annualRateToMonthlyRate(annualRatePercent);
  const target = resolveGrowthTarget(event);
  const field = targetField(target);
  const allocationShare = clampShare(event.metadata?.allocationShare);
  const baseBalance = Number(context.openingBalances[field] ?? 0) * allocationShare;
  const growthAmount = baseBalance > 0 && monthlyRate > 0 ? baseBalance * monthlyRate : 0;

  if (growthAmount === 0) {
    return {
      balanceDelta: {},
      contributionsDelta: 0,
      growthDelta: 0,
      loanPrincipalReductionDelta: 0,
      goalFundingDelta: 0,
      inflationImpactDelta: 0,
    };
  }

  const balanceDelta: Partial<ProjectionBalanceState> = {
    [field]: growthAmount,
    netWorth: growthAmount,
  };

  if (target === "retirement") {
    balanceDelta.investments = growthAmount;
  }

  return {
    balanceDelta,
    contributionsDelta: 0,
    growthDelta: growthAmount,
    loanPrincipalReductionDelta: 0,
    goalFundingDelta: 0,
    inflationImpactDelta: 0,
  };
}

function growthEvent(
  id: string,
  name: string,
  startMonth: string,
  config: {
    type: ProjectionEventType;
    module: FinancialEvent["module"];
    annualRate: number;
    growthTarget: GrowthTarget;
    allocationShare?: number;
  },
): FinancialEvent {
  return {
    id,
    module: config.module,
    type: config.type,
    name,
    amount: config.annualRate,
    date: monthDate(startMonth),
    frequency: "monthly",
    repeatEveryMonths: 1,
    startsOn: monthDate(startMonth),
    endsOn: null,
    isEnabled: config.annualRate > 0,
    metadata: {
      source: "assumption",
      growthTarget: config.growthTarget,
      annualRate: config.annualRate,
      monthlyRate: annualRateToMonthlyRate(config.annualRate),
      allocationShare: config.allocationShare,
    },
  };
}

export function buildGrowthEventsFromAssumptions(bundle: AssumptionsBundle): FinancialEvent[] {
  const startMonth = bundle.planning.startMonth;
  const investmentRate = Number(bundle.investments.expectedReturnRate ?? 0);
  const fixedDepositRate = Number(bundle.investments.fixedDepositRate ?? 0);
  const goldRate = Number(bundle.investments.goldAppreciationRate ?? 0);
  const realEstateRate = Number(bundle.investments.realEstateAppreciationRate ?? 0);

  const events: FinancialEvent[] = [
    growthEvent("assumption:growth:mutual-funds", "Mutual Funds Growth", startMonth, {
      type: "mutual-fund-growth",
      module: "investments",
      annualRate: investmentRate,
      growthTarget: "investments",
      allocationShare: 1 / 3,
    }),
    growthEvent("assumption:growth:stocks", "Stocks Growth", startMonth, {
      type: "stock-growth",
      module: "investments",
      annualRate: investmentRate,
      growthTarget: "investments",
      allocationShare: 1 / 3,
    }),
    growthEvent("assumption:growth:fixed-deposits", "Fixed Deposit Growth", startMonth, {
      type: "fixed-deposit-growth",
      module: "fixed-deposits",
      annualRate: fixedDepositRate,
      growthTarget: "investments",
      allocationShare: 1 / 3,
    }),
    growthEvent("assumption:growth:epf", "EPF Growth", startMonth, {
      type: "epf-growth",
      module: "retirement",
      annualRate: fixedDepositRate,
      growthTarget: "retirement",
      allocationShare: 1 / 3,
    }),
    growthEvent("assumption:growth:ppf", "PPF Growth", startMonth, {
      type: "ppf-growth",
      module: "retirement",
      annualRate: fixedDepositRate,
      growthTarget: "retirement",
      allocationShare: 1 / 3,
    }),
    growthEvent("assumption:growth:nps", "NPS Growth", startMonth, {
      type: "nps-growth",
      module: "retirement",
      annualRate: investmentRate,
      growthTarget: "retirement",
      allocationShare: 1 / 3,
    }),
    growthEvent("assumption:growth:gold", "Gold Appreciation", startMonth, {
      type: "gold-appreciation",
      module: "gold",
      annualRate: goldRate,
      growthTarget: "assets",
      allocationShare: 1 / 3,
    }),
    growthEvent("assumption:growth:silver", "Silver Appreciation", startMonth, {
      type: "silver-appreciation",
      module: "silver",
      annualRate: goldRate,
      growthTarget: "assets",
      allocationShare: 1 / 3,
    }),
    growthEvent("assumption:growth:real-estate", "Real Estate Appreciation", startMonth, {
      type: "real-estate-appreciation",
      module: "real-estate",
      annualRate: realEstateRate,
      growthTarget: "assets",
      allocationShare: 1 / 3,
    }),
  ];

  return events.filter((event) => event.isEnabled && Number(event.metadata?.annualRate ?? 0) > 0);
}

export const growthProcessor: FinancialEventProcessor = {
  id: "growth-processor",
  supports(event) {
    return GROWTH_EVENT_TYPES.includes(event.type);
  },
  buildEffect(context) {
    return buildGrowthEffect(context);
  },
};

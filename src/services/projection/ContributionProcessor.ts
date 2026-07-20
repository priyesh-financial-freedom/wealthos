import type { AssumptionsBundle } from "@/types/assumptions";
import type {
  FinancialEvent,
  ProjectionEventType,
} from "@/types/projection";
import type { EventEffect, EventProcessorContext, FinancialEventProcessor } from "@/services/projection/EventEngine";

const CONTRIBUTION_TYPES: ProjectionEventType[] = [
  "monthly-contribution",
  "bonus",
  "epf-contribution",
  "nps-contribution",
  "ppf-contribution",
  "mutual-fund-sip",
  "stock-investment",
  "fixed-deposit",
];

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

function assumptionEvent(
  id: string,
  name: string,
  amount: number,
  startMonth: string,
  config: {
    type: ProjectionEventType;
    module: FinancialEvent["module"];
    frequency?: FinancialEvent["frequency"];
    repeatEveryMonths?: number | null;
    metadata?: FinancialEvent["metadata"];
  },
): FinancialEvent {
  return {
    id,
    module: config.module,
    type: config.type,
    name,
    amount,
    date: monthDate(startMonth),
    frequency: config.frequency ?? "monthly",
    repeatEveryMonths: config.repeatEveryMonths ?? null,
    startsOn: monthDate(startMonth),
    endsOn: null,
    isEnabled: amount > 0,
    metadata: {
      source: "assumption",
      ...(config.metadata ?? {}),
    },
  };
}

export function buildContributionEventsFromAssumptions(bundle: AssumptionsBundle): FinancialEvent[] {
  const startMonth = bundle.planning.startMonth;

  const salaryAmount = Number(bundle.income.monthlyIncome ?? 0);
  const bonusAmount = Number(bundle.income.bonusAmount ?? 0);
  const epfRate = Number(bundle.retirement.epfEmployeeContributionRate ?? 0) + Number(bundle.retirement.epfEmployerContributionRate ?? 0);
  const npsRate = Number(bundle.retirement.npsContributionRate ?? 0);
  const ppfAmount = Number(bundle.retirement.ppfMonthlyContribution ?? 0);
  const sipAmount = Number(bundle.investments.monthlySipAmount ?? 0);
  const fixedInvestmentAmount = Number(bundle.investments.stockInvestmentAmount ?? 0);

  const epfAmount = salaryAmount > 0 && epfRate > 0 ? (salaryAmount * epfRate) / 100 : 0;
  const npsAmount = salaryAmount > 0 && npsRate > 0 ? (salaryAmount * npsRate) / 100 : 0;

  const events: FinancialEvent[] = [
    assumptionEvent("assumption:salary", "Salary", salaryAmount, startMonth, {
      type: "monthly-contribution",
      module: "cash-flow",
      metadata: { contributionTarget: "cash" },
    }),
    assumptionEvent("assumption:bonus", "Annual Bonus", bonusAmount, startMonth, {
      type: "bonus",
      module: "cash-flow",
      frequency: "yearly",
      metadata: {
        contributionTarget: "cash",
        customRecurrence: {
          monthsOfYear: [Math.min(12, Math.max(1, Number(bundle.income.bonusMonth || 3)))],
        },
      },
    }),
    assumptionEvent("assumption:epf", "EPF Contribution", epfAmount, startMonth, {
      type: "epf-contribution",
      module: "retirement",
      metadata: { contributionTarget: "retirement" },
    }),
    assumptionEvent("assumption:nps", "NPS Contribution", npsAmount, startMonth, {
      type: "nps-contribution",
      module: "retirement",
      metadata: { contributionTarget: "retirement" },
    }),
    assumptionEvent("assumption:ppf", "PPF Contribution", ppfAmount, startMonth, {
      type: "ppf-contribution",
      module: "retirement",
      metadata: { contributionTarget: "retirement" },
    }),
    assumptionEvent("assumption:sip", "Mutual Fund SIP", sipAmount, startMonth, {
      type: "mutual-fund-sip",
      module: "investments",
      metadata: { contributionTarget: "investments" },
    }),
    assumptionEvent("assumption:fixed-investment", "Fixed Monthly Investment", fixedInvestmentAmount, startMonth, {
      type: "stock-investment",
      module: "investments",
      metadata: { contributionTarget: "investments" },
    }),
  ];

  return events.filter((event) => event.isEnabled && Number(event.amount ?? 0) > 0);
}

function targetForEvent(event: FinancialEvent): "cash" | "investments" | "retirement" {
  const explicitTarget = event.metadata?.contributionTarget;
  if (explicitTarget === "cash" || explicitTarget === "investments" || explicitTarget === "retirement") {
    return explicitTarget;
  }

  if (event.type === "monthly-contribution" || event.type === "bonus") {
    return "cash";
  }

  if (event.type === "epf-contribution" || event.type === "nps-contribution" || event.type === "ppf-contribution") {
    return "retirement";
  }

  return "investments";
}

function buildContributionEffect(event: FinancialEvent): EventEffect {
  const amount = Number(event.amount ?? 0);
  const target = targetForEvent(event);

  if (target === "cash") {
    return {
      balanceDelta: {
        assets: amount,
        cash: amount,
        netWorth: amount,
      },
      contributionsDelta: amount,
      growthDelta: 0,
      loanPrincipalReductionDelta: 0,
      goalFundingDelta: 0,
      inflationImpactDelta: 0,
    };
  }

  if (target === "retirement") {
    return {
      balanceDelta: {
        investments: amount,
        retirement: amount,
        netWorth: amount,
      },
      contributionsDelta: amount,
      growthDelta: 0,
      loanPrincipalReductionDelta: 0,
      goalFundingDelta: 0,
      inflationImpactDelta: 0,
    };
  }

  return {
    balanceDelta: {
      investments: amount,
      netWorth: amount,
    },
    contributionsDelta: amount,
    growthDelta: 0,
    loanPrincipalReductionDelta: 0,
    goalFundingDelta: 0,
    inflationImpactDelta: 0,
  };
}

export const contributionProcessor: FinancialEventProcessor = {
  id: "contribution-processor",
  supports(event) {
    return CONTRIBUTION_TYPES.includes(event.type);
  },
  buildEffect(context: EventProcessorContext) {
    return buildContributionEffect(context.event);
  },
};

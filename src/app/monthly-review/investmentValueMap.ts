import type { Investment } from "@/types/investment";
import type { MonthEndCloseWorkspace } from "@/types/monthEndClose";

const RETIREMENT_INVESTMENT_CATEGORIES = new Set(["EPF", "PPF", "NPS"]);
const GOLD_INVESTMENT_CATEGORIES = new Set(["Gold", "Sovereign Gold Bonds"]);
const SILVER_INVESTMENT_CATEGORIES = new Set(["Silver"]);

export interface InvestmentValueMapResult {
  valuesById: Record<string, string>;
  warningMessage: string | null;
  missingRows: Array<{ id: string; name: string; category: string }>;
}

interface InvestmentValueMapOptions {
  hasDedicatedRetirementAccounts?: boolean;
  hasDedicatedGoldHoldings?: boolean;
  hasDedicatedSilverHoldings?: boolean;
}

function shouldIgnoreByCanonicalSource(investment: Investment, options: InvestmentValueMapOptions) {
  if (options.hasDedicatedRetirementAccounts && RETIREMENT_INVESTMENT_CATEGORIES.has(investment.category)) {
    return true;
  }

  if (options.hasDedicatedGoldHoldings && GOLD_INVESTMENT_CATEGORIES.has(investment.category)) {
    return true;
  }

  if (options.hasDedicatedSilverHoldings && SILVER_INVESTMENT_CATEGORIES.has(investment.category)) {
    return true;
  }

  return false;
}

export function buildInvestmentValueMap(
  workspace: MonthEndCloseWorkspace,
  investments: Investment[],
  options: InvestmentValueMapOptions = {},
): InvestmentValueMapResult {
  const workspaceByEntityId = new Map(
    workspace.items
      .filter((item) => item.entityType === "investment")
      .map((item) => [item.entityId, item.actualValue]),
  );

  const relevantInvestments = investments.filter((investment) => investment.status === "active" && !shouldIgnoreByCanonicalSource(investment, options));
  const missing = relevantInvestments.filter((investment) => !workspaceByEntityId.has(investment.id));

  if (missing.length > 0) {
    const details = missing.map((investment) => `${investment.id}:${investment.investment_name}:${investment.category}`).join(", ");
    console.warn(`Month-end workspace is missing investment snapshot rows: ${details}`);
  }

  const valuesById = investments.reduce<Record<string, string>>((acc, item) => {
    const value = workspaceByEntityId.get(item.id);
    acc[item.id] = String(value ?? item.current_value ?? 0);
    return acc;
  }, {});

  return {
    valuesById,
    warningMessage: missing.length > 0
      ? "Some investments are not included in month-end review. Please check category mapping."
      : null,
    missingRows: missing.map((investment) => ({
      id: investment.id,
      name: investment.investment_name,
      category: investment.category,
    })),
  };
}

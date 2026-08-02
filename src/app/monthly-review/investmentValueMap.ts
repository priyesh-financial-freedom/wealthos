import type { Investment } from "@/types/investment";
import type { MonthEndCloseWorkspace } from "@/types/monthEndClose";

export interface InvestmentValueMapResult {
  valuesById: Record<string, string>;
  warningMessage: string | null;
  missingRows: Array<{ id: string; name: string; category: string }>;
}

export function buildInvestmentValueMap(workspace: MonthEndCloseWorkspace, investments: Investment[]): InvestmentValueMapResult {
  const workspaceByEntityId = new Map(
    workspace.items
      .filter((item) => item.entityType === "investment")
      .map((item) => [item.entityId, item.actualValue]),
  );

  const relevantInvestments = investments.filter((investment) => investment.status === "active");
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

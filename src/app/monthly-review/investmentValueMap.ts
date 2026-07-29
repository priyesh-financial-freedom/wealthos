import type { Investment } from "@/types/investment";
import type { MonthEndCloseWorkspace } from "@/types/monthEndClose";

export function buildInvestmentValueMap(workspace: MonthEndCloseWorkspace, investments: Investment[]) {
  const workspaceByEntityId = new Map(
    workspace.items
      .filter((item) => item.entityType === "investment")
      .map((item) => [item.entityId, item.actualValue]),
  );

  const missing = investments.filter((investment) => !workspaceByEntityId.has(investment.id));
  if (missing.length > 0) {
    const details = missing.map((investment) => `${investment.id}:${investment.investment_name}`).join(", ");
    throw new Error(`Month-end workspace is missing investment snapshot rows: ${details}`);
  }

  return investments.reduce<Record<string, string>>((acc, item) => {
    const value = workspaceByEntityId.get(item.id);
    acc[item.id] = String(value);
    return acc;
  }, {});
}

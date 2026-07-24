import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";

import { roundCurrency } from "./step-helpers";

export class TaxStep implements ProjectionStep {
  readonly id = "tax-step";

  execute(context: ProjectionContext): ProjectionContext {
    const grossIncome =
      Number(context.currentRecord.salary ?? 0) +
      Number(context.currentRecord.bonus ?? 0) +
      Number(context.currentRecord.rentalIncome ?? 0) +
      Number(context.currentRecord.businessIncome ?? 0) +
      Number(context.currentRecord.otherIncome ?? 0);
    const taxes = roundCurrency(grossIncome * (Number(context.taxes.effectiveTaxRate ?? 0) / 100));

    return updateProjectionRecord(
      context,
      { taxes },
      {
        cash: roundCurrency(context.currentState.cash - taxes),
      },
    );
  }
}
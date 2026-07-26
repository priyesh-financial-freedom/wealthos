import type { FormulaMetadata } from "./FormulaMetadata";

export interface FormulaReference {
  formulaId: string;
  module: string;
  version: string;
  effectiveDate: string;
  owner: string;
  validationStatus: FormulaMetadata["validationStatus"];
}

export function createFormulaReference(metadata: FormulaMetadata): FormulaReference {
  return {
    formulaId: metadata.formulaId,
    module: metadata.module,
    version: metadata.version,
    effectiveDate: metadata.effectiveDate,
    owner: metadata.owner,
    validationStatus: metadata.validationStatus,
  };
}

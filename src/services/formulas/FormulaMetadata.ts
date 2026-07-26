export type FormulaValidationStatus = "Validated" | "Draft" | "Deprecated";

export interface FormulaMetadata {
  formulaId: string;
  module: string;
  description: string;
  excelEquivalent: string;
  formulaExpression: string;
  version: string;
  effectiveDate: string;
  owner: string;
  exampleInput: string;
  exampleOutput: string;
  validationStatus: FormulaValidationStatus;
}

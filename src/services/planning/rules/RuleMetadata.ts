import type { FormulaReference } from "@/services/formulas";
import type { RuleCategory } from "./Types";

export interface RuleMetadata {
  ruleId: string;
  ruleName: string;
  description: string;
  category: RuleCategory;
  priority: number;
  effectiveDate: string;
  expiryDate: string | null;
  version: string;
  formulaReference: FormulaReference;
  dependencies: readonly string[];
  evaluationFunctionName: string;
  enabled: boolean;
}

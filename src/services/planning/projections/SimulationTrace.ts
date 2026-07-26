import type { FormulaReference } from "@/services/formulas";

export interface SimulationTrace {
  ruleId: string;
  formula: FormulaReference;
  inputReferences: readonly string[];
  outputValues: Readonly<Record<string, number>>;
  effectiveVersion: string;
  timestamp: string;
  sourceModule: string;
}

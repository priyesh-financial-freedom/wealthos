import { createFormulaReference, type FormulaReference } from "./FormulaReference";
import { formulaValidator, type FormulaValidationIssue } from "./FormulaValidator";
import type { FormulaMetadata } from "./FormulaMetadata";

export class FormulaCatalog {
  private readonly formulas: readonly FormulaMetadata[];

  constructor(formulas: readonly FormulaMetadata[]) {
    this.formulas = formulas.map((formula) => ({ ...formula }));

    const issues = formulaValidator.validateCatalog(this.formulas);
    if (issues.length > 0) {
      throw new Error(`Invalid formula catalog: ${issues.map((issue) => `${issue.field}: ${issue.message}`).join("; ")}`);
    }
  }

  list(): FormulaMetadata[] {
    return this.formulas.map((formula) => ({ ...formula }));
  }

  listByModule(module: string): FormulaMetadata[] {
    return this.formulas.filter((formula) => formula.module === module).map((formula) => ({ ...formula }));
  }

  get(formulaId: string): FormulaMetadata {
    const formula = this.formulas.find((item) => item.formulaId === formulaId);
    if (!formula) {
      throw new Error(`Formula not found: ${formulaId}`);
    }

    return { ...formula };
  }

  has(formulaId: string): boolean {
    return this.formulas.some((item) => item.formulaId === formulaId);
  }

  reference(formulaId: string): FormulaReference {
    return createFormulaReference(this.get(formulaId));
  }

  validateReference(reference: FormulaReference): FormulaValidationIssue[] {
    return formulaValidator.validateReference(reference, this.formulas);
  }
}

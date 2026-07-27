import type { FinancialRule } from "../rules/contracts";

export interface ProductValidationIssue {
  field: string;
  message: string;
}

export interface ProductValidationResult {
  valid: boolean;
  issues: ProductValidationIssue[];
}

export interface FinancialProduct<TData = unknown> {
  readonly id: string;
  readonly type: string;
  readonly data: TData;
  validate(): ProductValidationResult;
  getRules(): readonly FinancialRule[];
}

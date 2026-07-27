export const placeholderService = {
  status: "ready",
};

export * from "@/services/formulas";
export * from "@/services/planning";
export * from "@/services/contributions";
export * from "@/services/projection-engine";
export * from "@/services/core/event-engine";
export * from "@/services/investmentManagement";
export * from "@/services/loanManagement";
export * from "@/services/assetManagement";
export * from "@/services/compensation";
export {
  MANUAL_EXPENSE_CATEGORIES,
  validateIncome,
  validateExpense,
  buildCashFlowSummary,
  buildCashFlowProjectionInput,
  CashFlowManagementService,
  cashFlowManagementService,
} from "@/services/cashFlowManagement";
export type {
  IncomeType,
  ExpenseCategory as CashFlowExpenseCategory,
  CashFlowStatus,
  IncomeEntry,
  ExpenseEntry,
  CommitmentSource,
  AutomaticCommitment,
  IncomeBreakdown,
  CommitmentGroup,
  LivingExpenseRecord,
  CashFlowSnapshot,
  IncomeCreateInput,
  IncomeUpdateInput,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  IncomeValidationIssue,
  ExpenseValidationIssue,
  CashFlowSummary,
  CashFlowProjectionInput,
} from "@/services/cashFlowManagement";

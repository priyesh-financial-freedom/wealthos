export const SUPPORTED_LOAN_TYPES = ["Home Loan", "Car Loan", "Personal Loan"] as const;

export type LoanType = (typeof SUPPORTED_LOAN_TYPES)[number];

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  "Home Loan": "Home Loan",
  "Car Loan": "Car Loan",
  "Personal Loan": "Personal Loan",
};

export function isSupportedLoanType(value: string): value is LoanType {
  return (SUPPORTED_LOAN_TYPES as readonly string[]).includes(value);
}

import type { LoanType } from "./LoanTypes";

export type LoanPrepaymentMode = "REDUCE_TENURE" | "REDUCE_EMI";

export interface LoanScheduleInput {
  loanId: string;
  loanType: LoanType;
  openingBalance: number;
  annualInterestRate: number;
  emi: number;
  startMonth: string;
  tenureMonths: number | null;
  prepaymentAmount?: number | null;
  prepaymentMonth?: string | null;
  prepaymentMode?: LoanPrepaymentMode;
  maxMonths?: number;
}

export interface LoanScheduleRow {
  month: string;
  openingBalance: number;
  interest: number;
  principal: number;
  emi: number;
  prepayment: number;
  closingBalance: number;
  interestSaved: number;
}

export interface LoanScheduleSummary {
  outstanding: number;
  emi: number;
  interestRemaining: number;
  interestPaid: number;
  principalPaid: number;
  tenureRemaining: number;
  interestSaved: number;
  loanClosureDate: string | null;
  totalInterest: number;
  totalPrincipal: number;
  totalPrepayment: number;
  totalInterestSaved: number;
  totalPaid: number;
  closingBalance: number;
  closedInMonth: string | null;
}

export interface LoanSchedule {
  loanId: string;
  loanType: LoanType;
  annualInterestRate: number;
  emi: number;
  startMonth: string;
  tenureMonths: number | null;
  prepaymentMode: LoanPrepaymentMode;
  rows: LoanScheduleRow[];
  summary: LoanScheduleSummary;
}

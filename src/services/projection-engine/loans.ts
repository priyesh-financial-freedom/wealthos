import type { LoanState } from "./types";

export interface LoanMonthResult {
  id: string;
  interest: number;
  principal: number;
  payment: number;
  closingOutstanding: number;
}

export interface LoansMonthCalculationResult {
  totalInterest: number;
  totalPrincipal: number;
  totalPayment: number;
  totalOutstanding: number;
  monthResults: LoanMonthResult[];
  nextLoanStates: LoanState[];
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function monthlyRateFromAnnualPercent(annualRatePercent: number): number {
  return Math.max(0, toFiniteNumber(annualRatePercent) / 100 / 12);
}

function calculateSingleLoanMonth(loan: LoanState): LoanMonthResult {
  const openingOutstanding = Math.max(0, toFiniteNumber(loan.outstandingPrincipal));
  const monthlyRate = monthlyRateFromAnnualPercent(loan.annualInterestRate);
  const emi = Math.max(0, toFiniteNumber(loan.emi));
  const interest = openingOutstanding * monthlyRate;
  const principal = Math.max(0, Math.min(openingOutstanding, emi - interest));
  const payment = interest + principal;
  const closingOutstanding = Math.max(0, openingOutstanding - principal);

  return {
    id: loan.id,
    interest,
    principal,
    payment,
    closingOutstanding,
  };
}

export function calculateLoansForMonth(loans: LoanState[]): LoansMonthCalculationResult {
  const monthResults = loans.map(calculateSingleLoanMonth);
  const totalInterest = monthResults.reduce((sum, result) => sum + result.interest, 0);
  const totalPrincipal = monthResults.reduce((sum, result) => sum + result.principal, 0);
  const totalPayment = monthResults.reduce((sum, result) => sum + result.payment, 0);
  const totalOutstanding = monthResults.reduce((sum, result) => sum + result.closingOutstanding, 0);

  return {
    totalInterest,
    totalPrincipal,
    totalPayment,
    totalOutstanding,
    monthResults,
    nextLoanStates: loans.map((loan, index) => ({
      ...loan,
      outstandingPrincipal: monthResults[index]?.closingOutstanding ?? 0,
    })),
  };
}
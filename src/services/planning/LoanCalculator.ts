import type { Liability } from "@/types/liability";

import { SUPPORTED_LOAN_TYPES, isSupportedLoanType, type LoanType } from "./LoanTypes";
import type { LoanSchedule, LoanScheduleInput, LoanScheduleRow } from "./LoanSchedule";
import {
  addMonths,
  calculateEmi,
  clampToBalance,
  compareMonthKeys,
  monthlyInterestRate,
  roundCurrency,
} from "./LoanUtils";

export interface LoanCalculatorLoanInput {
  loanId: string;
  loanType: LoanType;
  openingBalance: number;
  annualInterestRate: number;
  emi: number;
  startMonth: string;
  tenureMonths?: number | null;
  prepaymentAmount?: number | null;
  prepaymentMonth?: string | null;
  prepaymentMode?: LoanScheduleInput["prepaymentMode"];
}

export interface LoanMonthCalculationInput extends LoanCalculatorLoanInput {
  monthKey: string;
  monthsRemaining: number | null;
}

function remainingMonthsAfterCurrent(monthsRemaining: number | null): number | null {
  if (monthsRemaining === null) {
    return null;
  }

  return Math.max(0, monthsRemaining - 1);
}

function estimateFutureInterest(
  openingBalance: number,
  emi: number,
  monthlyRate: number,
  monthsRemaining: number | null,
  prepaymentMode: LoanScheduleInput["prepaymentMode"],
  prepaymentAmount: number,
  recalculateEmiForRemainingMonths: boolean,
): number {
  let outstanding = roundCurrency(openingBalance);
  let currentEmi = roundCurrency(emi);
  let totalInterest = 0;
  let monthCounter = 0;
  const maxMonths = Math.max(1, monthsRemaining ?? 600);

  while (outstanding > 0 && monthCounter < maxMonths) {
    const interest = roundCurrency(outstanding * monthlyRate);
    totalInterest = roundCurrency(totalInterest + interest);

    const principal = clampToBalance(Math.max(0, currentEmi - interest), outstanding);
    outstanding = roundCurrency(outstanding - principal);

    if (prepaymentAmount > 0) {
      const appliedPrepayment = clampToBalance(prepaymentAmount, outstanding);
      outstanding = roundCurrency(outstanding - appliedPrepayment);

      if (recalculateEmiForRemainingMonths && prepaymentMode === "REDUCE_EMI") {
        const nextRemainingMonths = remainingMonthsAfterCurrent(maxMonths - monthCounter - 1);
        if (nextRemainingMonths !== null && nextRemainingMonths > 0 && outstanding > 0) {
          currentEmi = calculateEmi(outstanding, monthlyRate, nextRemainingMonths);
        }
      }
    }

    monthCounter += 1;
  }

  return roundCurrency(totalInterest);
}

export function calculateLoanMonth(input: LoanMonthCalculationInput): LoanScheduleRow {
  const monthlyRate = monthlyInterestRate(input.annualInterestRate);
  const openingBalance = roundCurrency(input.openingBalance);
  const emi = roundCurrency(input.emi);
  const interest = roundCurrency(openingBalance * monthlyRate);
  const principal = clampToBalance(Math.max(0, emi - interest), openingBalance);
  const prepayment = clampToBalance(
    input.prepaymentMonth && compareMonthKeys(input.monthKey, input.prepaymentMonth) === 0 ? Number(input.prepaymentAmount ?? 0) : 0,
    Math.max(0, openingBalance - principal),
  );
  const closingBalance = roundCurrency(Math.max(0, openingBalance - principal - prepayment));

  let interestSaved = 0;
  if (prepayment > 0) {
    const futureMonths = remainingMonthsAfterCurrent(input.monthsRemaining);
    const baselineInterest = estimateFutureInterest(
      Math.max(0, openingBalance - principal),
      emi,
      monthlyRate,
      futureMonths,
      input.prepaymentMode ?? "REDUCE_TENURE",
      0,
      true,
    );
    const actualInterest = estimateFutureInterest(
      closingBalance,
      input.prepaymentMode === "REDUCE_EMI" && futureMonths !== null && futureMonths > 0
        ? calculateEmi(closingBalance, monthlyRate, futureMonths)
        : emi,
      monthlyRate,
      futureMonths,
      input.prepaymentMode ?? "REDUCE_TENURE",
      0,
      true,
    );

    interestSaved = roundCurrency(Math.max(0, baselineInterest - actualInterest));
  }

  return {
    month: input.monthKey,
    openingBalance,
    interest,
    principal,
    emi,
    prepayment,
    closingBalance,
    interestSaved,
  };
}

export function calculateLoanSchedule(input: LoanScheduleInput): LoanSchedule {
  const loanType = input.loanType;
  if (!SUPPORTED_LOAN_TYPES.includes(loanType)) {
    throw new Error(`Unsupported loan type: ${loanType}`);
  }

  const monthlyRate = monthlyInterestRate(input.annualInterestRate);
  const rows: LoanScheduleRow[] = [];
  let currentMonth = input.startMonth;
  let openingBalance = roundCurrency(input.openingBalance);
  let currentEmi = roundCurrency(input.emi);
  let totalInterest = 0;
  let totalPrincipal = 0;
  let totalPrepayment = 0;
  let totalInterestSaved = 0;
  let closedInMonth: string | null = null;

  const maxMonths = Math.max(1, input.maxMonths ?? input.tenureMonths ?? 600);

  for (let monthIndex = 0; monthIndex < maxMonths && openingBalance > 0; monthIndex += 1) {
    const monthsRemaining = input.tenureMonths === null || input.tenureMonths === undefined ? null : Math.max(0, input.tenureMonths - monthIndex);
    const row = calculateLoanMonth({
      ...input,
      monthKey: currentMonth,
      openingBalance,
      emi: currentEmi,
      monthsRemaining,
    });

    rows.push(row);
    totalInterest = roundCurrency(totalInterest + row.interest);
    totalPrincipal = roundCurrency(totalPrincipal + row.principal);
    totalPrepayment = roundCurrency(totalPrepayment + row.prepayment);
    totalInterestSaved = roundCurrency(totalInterestSaved + row.interestSaved);

    openingBalance = row.closingBalance;
    closedInMonth = openingBalance <= 0 ? row.month : null;

    if (openingBalance <= 0) {
      break;
    }

    const monthsRemainingAfterThisMonth = input.tenureMonths === null || input.tenureMonths === undefined ? null : Math.max(0, input.tenureMonths - monthIndex - 1);
    if (row.prepayment > 0 && input.prepaymentMode === "REDUCE_EMI" && monthsRemainingAfterThisMonth !== null && monthsRemainingAfterThisMonth > 0) {
      currentEmi = calculateEmi(openingBalance, monthlyRate, monthsRemainingAfterThisMonth);
    }

    currentMonth = addMonths(currentMonth, 1);
  }

  return {
    loanId: input.loanId,
    loanType,
    annualInterestRate: roundCurrency(input.annualInterestRate),
    emi: roundCurrency(input.emi),
    startMonth: input.startMonth,
    tenureMonths: input.tenureMonths ?? null,
    prepaymentMode: input.prepaymentMode ?? "REDUCE_TENURE",
    rows,
    summary: {
      outstanding: openingBalance,
      emi: roundCurrency(currentEmi),
      interestRemaining: totalInterest,
      interestPaid: 0,
      principalPaid: totalPrincipal,
      tenureRemaining: rows.length,
      interestSaved: totalInterestSaved,
      loanClosureDate: closedInMonth,
      totalInterest,
      totalPrincipal,
      totalPrepayment,
      totalInterestSaved,
      totalPaid: roundCurrency(totalPrincipal + totalInterest + totalPrepayment),
      closingBalance: openingBalance,
      closedInMonth,
    },
  };
}

export function buildLoanScheduleFromLiability(liability: Liability, monthKey: string, prepaymentAmount = 0): LoanSchedule {
  if (!isSupportedLoanType(liability.liability_type)) {
    throw new Error(`Unsupported loan type: ${liability.liability_type}`);
  }

  return calculateLoanSchedule({
    loanId: liability.id,
    loanType: liability.liability_type,
    openingBalance: Number(liability.outstanding_amount ?? 0),
    annualInterestRate: Number(liability.interest_rate ?? 0),
    emi: Number(liability.emi ?? 0),
    startMonth: monthKey,
    tenureMonths: Number(liability.tenure_months ?? 0) || null,
    prepaymentAmount,
    prepaymentMonth: prepaymentAmount > 0 ? monthKey : null,
    prepaymentMode: "REDUCE_TENURE",
  });
}

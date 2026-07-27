import type { LoanState, ProjectionBalances } from "../types";

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clampNonNegative(value: number): number {
  return Math.max(0, value);
}

export class MonthlyProjectionDomainState {
  private readonly openingBalances: ProjectionBalances;

  private income = 0;

  private expenses = 0;

  private eventImpact = 0;

  private contribution = 0;

  private investmentGrowth = 0;

  private assetAppreciation = 0;

  private loanPayment = 0;

  private loanInterest = 0;

  private loanPrincipal = 0;

  private liabilityDelta = 0;

  private retired = false;

  private readonly notes: string[] = [];

  constructor(
    openingBalances: ProjectionBalances,
    private loans: LoanState[],
  ) {
    this.openingBalances = { ...openingBalances };
    this.loans = loans.map((loan) => ({ ...loan }));
  }

  addIncome(amount: number): void {
    this.income += clampNonNegative(toFiniteNumber(amount));
  }

  addExpense(amount: number): void {
    this.expenses += clampNonNegative(toFiniteNumber(amount));
  }

  addEventCashImpact(amount: number): void {
    this.eventImpact += toFiniteNumber(amount);
  }

  addContribution(amount: number): void {
    this.contribution += clampNonNegative(toFiniteNumber(amount));
  }

  addInvestmentGrowth(amount: number): void {
    this.investmentGrowth += clampNonNegative(toFiniteNumber(amount));
  }

  addAssetAppreciation(amount: number): void {
    this.assetAppreciation += clampNonNegative(toFiniteNumber(amount));
  }

  applyLoanComputation(input: {
    totalPayment: number;
    totalInterest: number;
    totalPrincipal: number;
    nextLoans: LoanState[];
  }): void {
    this.loanPayment += clampNonNegative(toFiniteNumber(input.totalPayment));
    this.loanInterest += clampNonNegative(toFiniteNumber(input.totalInterest));
    this.loanPrincipal += clampNonNegative(toFiniteNumber(input.totalPrincipal));
    this.loans = input.nextLoans.map((loan) => ({ ...loan }));
  }

  applyLoanPrepayment(amount: number): void {
    const prepayment = clampNonNegative(toFiniteNumber(amount));
    if (prepayment <= 0 || this.loans.length === 0) {
      return;
    }

    const totalOutstanding = this.loans.reduce(
      (sum, loan) => sum + clampNonNegative(toFiniteNumber(loan.outstandingPrincipal)),
      0,
    );
    if (totalOutstanding <= 0) {
      return;
    }

    this.addEventCashImpact(-prepayment);

    this.loans = this.loans.map((loan) => {
      const outstanding = clampNonNegative(toFiniteNumber(loan.outstandingPrincipal));
      const share = outstanding / totalOutstanding;
      const reduction = prepayment * share;

      return {
        ...loan,
        outstandingPrincipal: clampNonNegative(outstanding - reduction),
      };
    });
  }

  addLiabilityDelta(amount: number): void {
    this.liabilityDelta += toFiniteNumber(amount);
  }

  markRetired(): void {
    this.retired = true;
  }

  isRetired(): boolean {
    return this.retired;
  }

  getLoans(): LoanState[] {
    return this.loans.map((loan) => ({ ...loan }));
  }

  recordNote(note: string): void {
    const trimmed = note.trim();
    if (trimmed.length > 0) {
      this.notes.push(trimmed);
    }
  }

  snapshot(input: {
    assetBaseNonInvestment: number;
    eventAssetDelta: number;
  }): {
    opening: ProjectionBalances;
    activity: {
      income: number;
      expenses: number;
      eventImpact: number;
      contribution: number;
      investmentGrowth: number;
      assetAppreciation: number;
      loanPayment: number;
      loanInterest: number;
      loanPrincipal: number;
      netCashFlow: number;
    };
    closing: ProjectionBalances;
    loans: LoanState[];
    notes: string[];
  } {
    const opening = { ...this.openingBalances };
    const closingCash =
      opening.cash
      + this.income
      - this.expenses
      + this.eventImpact
      - this.contribution
      - this.loanPayment;
    const closingInvestments = opening.investments + this.contribution + this.investmentGrowth;
    const closingLoanOutstanding = this.loans.reduce(
      (sum, loan) => sum + clampNonNegative(toFiniteNumber(loan.outstandingPrincipal)),
      0,
    );
    const closingLiabilities = clampNonNegative(closingLoanOutstanding + this.liabilityDelta);
    const closingAssets =
      closingCash
      + closingInvestments
      + clampNonNegative(toFiniteNumber(input.assetBaseNonInvestment))
      + this.assetAppreciation
      + toFiniteNumber(input.eventAssetDelta);

    const closing: ProjectionBalances = {
      cash: closingCash,
      investments: closingInvestments,
      assets: clampNonNegative(closingAssets),
      liabilities: closingLiabilities,
      loanOutstanding: closingLoanOutstanding,
      netWorth: clampNonNegative(closingAssets) - closingLiabilities,
    };

    return {
      opening,
      activity: {
        income: this.income,
        expenses: this.expenses,
        eventImpact: this.eventImpact,
        contribution: this.contribution,
        investmentGrowth: this.investmentGrowth,
        assetAppreciation: this.assetAppreciation,
        loanPayment: this.loanPayment,
        loanInterest: this.loanInterest,
        loanPrincipal: this.loanPrincipal,
        netCashFlow:
          this.income
          - this.expenses
          + this.eventImpact
          - this.contribution
          - this.loanPayment,
      },
      closing,
      loans: this.getLoans(),
      notes: [...this.notes],
    };
  }
}
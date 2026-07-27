import type { LoanAssumption, ProjectionEvent } from "@/services/projection-engine";
import type { Liability, LiabilityInsert, LiabilityUpdate } from "@/types/liability";

import {
  createLiability,
  deleteLiability,
  getLiabilities,
  updateLiability,
} from "@/services/liabilities";

export type LoanType =
  | "Home Loan"
  | "Car Loan"
  | "Personal Loan"
  | "Education Loan"
  | "Loan Against Property"
  | "Other";

export type LoanStatus = "Active" | "Closed";

export type PrepaymentFrequency = "None" | "Monthly" | "Quarterly" | "Annual" | "One-Time";

export interface Loan {
  id: string;
  name: string;
  lender: string;
  loanType: LoanType;
  outstandingAmount: number;
  interestRate: number;
  emi: number;
  tenureMonths: number;
  remainingMonths: number;
  startDate: string | null;
  endDate: string | null;
  prepaymentAmount: number;
  prepaymentFrequency: PrepaymentFrequency;
  status: LoanStatus;
  notes: string | null;
}

export type LoanCreateInput = Omit<Loan, "id">;
export type LoanUpdateInput = Partial<Omit<Loan, "id">>;

export interface LoanValidationIssue {
  field: keyof LoanCreateInput;
  message: string;
}

export interface LoanSummary {
  totalOutstanding: number;
  totalEmi: number;
  averageInterestRate: number;
  activeLoans: number;
  closedLoans: number;
  upcomingPrepayments: number;
}

export interface LoanProjectionIntegration {
  loanAssumptions: LoanAssumption[];
  prepaymentEvents: ProjectionEvent[];
}

interface LoanMeta {
  remainingMonths?: number;
  prepaymentAmount?: number;
  prepaymentFrequency?: PrepaymentFrequency;
}

const META_PREFIX = "__LOAN_META__:";

const loanTypeToLiabilityType: Record<LoanType, Liability["liability_type"]> = {
  "Home Loan": "Home Loan",
  "Car Loan": "Car Loan",
  "Personal Loan": "Personal Loan",
  "Education Loan": "Education Loan",
  "Loan Against Property": "Loan Against Property",
  Other: "Other Liability",
};

const liabilityTypeToLoanType: Partial<Record<Liability["liability_type"], LoanType>> = {
  "Home Loan": "Home Loan",
  "Car Loan": "Car Loan",
  "Personal Loan": "Personal Loan",
  "Education Loan": "Education Loan",
  "Loan Against Property": "Loan Against Property",
  "Other Liability": "Other",
};

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeLoanStatus(value: string | null | undefined): LoanStatus {
  return value?.toLowerCase() === "closed" ? "Closed" : "Active";
}

function parseNotesWithMeta(raw: string | null | undefined): { notes: string | null; meta: LoanMeta } {
  if (!raw) {
    return { notes: null, meta: {} };
  }

  const lines = raw.split("\n");
  const metaLine = lines.find((line) => line.startsWith(META_PREFIX));
  if (!metaLine) {
    return { notes: raw, meta: {} };
  }

  let meta: LoanMeta = {};
  try {
    meta = JSON.parse(metaLine.slice(META_PREFIX.length)) as LoanMeta;
  } catch {
    meta = {};
  }

  const notes = lines.filter((line) => !line.startsWith(META_PREFIX)).join("\n").trim();
  return {
    notes: notes.length > 0 ? notes : null,
    meta,
  };
}

function composeNotes(notes: string | null | undefined, meta: LoanMeta): string | null {
  const cleanNotes = (notes ?? "").trim();
  const hasMeta =
    typeof meta.remainingMonths === "number"
    || typeof meta.prepaymentAmount === "number"
    || typeof meta.prepaymentFrequency === "string";

  if (!hasMeta) {
    return cleanNotes.length > 0 ? cleanNotes : null;
  }

  const compactMeta: LoanMeta = {
    ...(typeof meta.remainingMonths === "number" ? { remainingMonths: meta.remainingMonths } : {}),
    ...(typeof meta.prepaymentAmount === "number" ? { prepaymentAmount: meta.prepaymentAmount } : {}),
    ...(typeof meta.prepaymentFrequency === "string" ? { prepaymentFrequency: meta.prepaymentFrequency } : {}),
  };

  const metaPayload = `${META_PREFIX}${JSON.stringify(compactMeta)}`;
  return cleanNotes.length > 0 ? `${cleanNotes}\n${metaPayload}` : metaPayload;
}

function monthKey(dateIso: string): string {
  const [year, month] = dateIso.split("-");
  return `${year}-${month}`;
}

function isManagedLoanType(type: Liability["liability_type"]): boolean {
  return Boolean(liabilityTypeToLoanType[type]);
}

function mapLiabilityToLoan(liability: Liability): Loan {
  const parsed = parseNotesWithMeta(liability.notes);
  const loanType = liabilityTypeToLoanType[liability.liability_type] ?? "Other";

  return {
    id: liability.id,
    name: liability.account_name,
    lender: liability.lender,
    loanType,
    outstandingAmount: Math.max(0, toNumber(liability.outstanding_amount)),
    interestRate: Math.max(0, toNumber(liability.interest_rate)),
    emi: Math.max(0, toNumber(liability.emi)),
    tenureMonths: Math.max(0, toNumber(liability.tenure_months)),
    remainingMonths: Math.max(0, toNumber(parsed.meta.remainingMonths ?? liability.tenure_months ?? 0)),
    startDate: liability.start_date,
    endDate: liability.end_date,
    prepaymentAmount: Math.max(0, toNumber(parsed.meta.prepaymentAmount ?? 0)),
    prepaymentFrequency: parsed.meta.prepaymentFrequency ?? "None",
    status: normalizeLoanStatus(liability.status),
    notes: parsed.notes,
  };
}

function mapLoanToLiabilityInsert(input: LoanCreateInput): LiabilityInsert {
  return {
    liability_type: loanTypeToLiabilityType[input.loanType],
    lender: input.lender,
    account_name: input.name,
    outstanding_amount: roundTwo(Math.max(0, input.outstandingAmount)),
    interest_rate: roundTwo(Math.max(0, input.interestRate)),
    emi: roundTwo(Math.max(0, input.emi)),
    start_date: input.startDate,
    end_date: input.endDate,
    tenure_months: Math.max(0, Math.round(input.tenureMonths)),
    status: input.status === "Closed" ? "closed" : "active",
    notes: composeNotes(input.notes, {
      remainingMonths: Math.max(0, Math.round(input.remainingMonths)),
      prepaymentAmount: roundTwo(Math.max(0, input.prepaymentAmount)),
      prepaymentFrequency: input.prepaymentFrequency,
    }),
  };
}

function mapLoanUpdatesToLiabilityUpdate(current: Liability, updates: LoanUpdateInput): LiabilityUpdate {
  const parsed = parseNotesWithMeta(current.notes);
  const nextMeta: LoanMeta = {
    remainingMonths: updates.remainingMonths ?? parsed.meta.remainingMonths,
    prepaymentAmount: updates.prepaymentAmount ?? parsed.meta.prepaymentAmount,
    prepaymentFrequency: updates.prepaymentFrequency ?? parsed.meta.prepaymentFrequency,
  };

  return {
    id: current.id,
    ...(updates.loanType ? { liability_type: loanTypeToLiabilityType[updates.loanType] } : {}),
    ...(typeof updates.lender === "string" ? { lender: updates.lender } : {}),
    ...(typeof updates.name === "string" ? { account_name: updates.name } : {}),
    ...(typeof updates.outstandingAmount === "number" ? { outstanding_amount: roundTwo(Math.max(0, updates.outstandingAmount)) } : {}),
    ...(typeof updates.interestRate === "number" ? { interest_rate: roundTwo(Math.max(0, updates.interestRate)) } : {}),
    ...(typeof updates.emi === "number" ? { emi: roundTwo(Math.max(0, updates.emi)) } : {}),
    ...(typeof updates.tenureMonths === "number" ? { tenure_months: Math.max(0, Math.round(updates.tenureMonths)) } : {}),
    ...(updates.startDate !== undefined ? { start_date: updates.startDate } : {}),
    ...(updates.endDate !== undefined ? { end_date: updates.endDate } : {}),
    ...(updates.status ? { status: updates.status === "Closed" ? "closed" : "active" } : {}),
    ...(updates.notes !== undefined || updates.remainingMonths !== undefined || updates.prepaymentAmount !== undefined || updates.prepaymentFrequency !== undefined
      ? { notes: composeNotes(updates.notes ?? parsed.notes, nextMeta) }
      : {}),
  };
}

export function validateLoan(input: LoanCreateInput): LoanValidationIssue[] {
  const issues: LoanValidationIssue[] = [];

  if (!String(input.name ?? "").trim()) {
    issues.push({ field: "name", message: "Name is required." });
  }

  if (!String(input.lender ?? "").trim()) {
    issues.push({ field: "lender", message: "Lender is required." });
  }

  if (toNumber(input.outstandingAmount) < 0) {
    issues.push({ field: "outstandingAmount", message: "Outstanding amount must be greater than or equal to 0." });
  }

  if (toNumber(input.interestRate) < 0 || toNumber(input.interestRate) > 100) {
    issues.push({ field: "interestRate", message: "Interest rate must be between 0 and 100." });
  }

  if (toNumber(input.emi) < 0) {
    issues.push({ field: "emi", message: "EMI must be greater than or equal to 0." });
  }

  if (toNumber(input.remainingMonths) < 0) {
    issues.push({ field: "remainingMonths", message: "Remaining months must be greater than or equal to 0." });
  }

  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end < start) {
      issues.push({ field: "endDate", message: "End date must be after start date." });
    }
  }

  return issues;
}

function assertValidLoan(input: LoanCreateInput): void {
  const issues = validateLoan(input);
  if (issues.length === 0) {
    return;
  }

  throw new Error(issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | "));
}

function activeLoanFilter(loan: Loan): boolean {
  return loan.status === "Active" && loan.outstandingAmount > 0;
}

export function buildLoanSummary(loans: readonly Loan[]): LoanSummary {
  const totalOutstanding = loans.reduce((sum, loan) => sum + Math.max(0, loan.outstandingAmount), 0);
  const totalEmi = loans.reduce((sum, loan) => sum + Math.max(0, loan.emi), 0);
  const activeLoans = loans.filter((loan) => loan.status === "Active").length;
  const closedLoans = loans.filter((loan) => loan.status === "Closed").length;
  const rates = loans
    .filter((loan) => loan.status === "Active")
    .map((loan) => loan.interestRate)
    .filter((rate) => Number.isFinite(rate) && rate >= 0);
  const averageInterestRate = rates.length > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
  const upcomingPrepayments = loans.filter((loan) => activeLoanFilter(loan) && loan.prepaymentAmount > 0 && loan.prepaymentFrequency !== "None").length;

  return {
    totalOutstanding: roundTwo(totalOutstanding),
    totalEmi: roundTwo(totalEmi),
    averageInterestRate: roundTwo(averageInterestRate),
    activeLoans,
    closedLoans,
    upcomingPrepayments,
  };
}

export function buildLoanSummaryFromLiabilities(liabilities: readonly Liability[]): LoanSummary {
  return buildLoanSummary(liabilities.filter((liability) => isManagedLoanType(liability.liability_type)).map(mapLiabilityToLoan));
}

export function generateLoanProjectionIntegration(loans: readonly Loan[]): LoanProjectionIntegration {
  const loanAssumptions: LoanAssumption[] = loans
    .filter(activeLoanFilter)
    .map((loan) => ({
      id: loan.id,
      outstandingPrincipal: Math.max(0, loan.outstandingAmount),
      annualInterestRate: Math.max(0, loan.interestRate),
      emi: Math.max(0, loan.emi),
    }));

  const prepaymentEvents: ProjectionEvent[] = loans
    .filter((loan) => activeLoanFilter(loan) && loan.prepaymentAmount > 0 && loan.prepaymentFrequency !== "None" && Boolean(loan.startDate))
    .map((loan) => {
      const frequency: ProjectionEvent["frequency"] = loan.prepaymentFrequency === "Monthly"
        ? "monthly"
        : loan.prepaymentFrequency === "Quarterly"
          ? "quarterly"
          : loan.prepaymentFrequency === "Annual"
            ? "annual"
            : "once";

      const startMonth = monthKey(loan.startDate ?? new Date().toISOString().slice(0, 10));

      return {
        id: `loan-prepayment:${loan.id}`,
        name: `${loan.name} prepayment`,
        category: "Loan Prepayment",
        effectiveMonth: startMonth,
        startMonth,
        endMonth: loan.endDate ? monthKey(loan.endDate) : undefined,
        amount: roundTwo(loan.prepaymentAmount),
        frequency,
        enabled: true,
      };
    });

  return {
    loanAssumptions,
    prepaymentEvents,
  };
}

export class LoanManagementService {
  async listLoans(): Promise<Loan[]> {
    const liabilities = await getLiabilities();
    return liabilities
      .filter((liability) => isManagedLoanType(liability.liability_type))
      .map(mapLiabilityToLoan);
  }

  async addLoan(input: LoanCreateInput): Promise<Loan> {
    assertValidLoan(input);
    const created = await createLiability(mapLoanToLiabilityInsert(input));
    return mapLiabilityToLoan(created);
  }

  async editLoan(id: string, updates: LoanUpdateInput): Promise<Loan> {
    const liabilities = await getLiabilities();
    const current = liabilities.find((liability) => liability.id === id);
    if (!current) {
      throw new Error("Loan not found.");
    }

    const currentLoan = mapLiabilityToLoan(current);
    const merged: LoanCreateInput = {
      name: updates.name ?? currentLoan.name,
      lender: updates.lender ?? currentLoan.lender,
      loanType: updates.loanType ?? currentLoan.loanType,
      outstandingAmount: updates.outstandingAmount ?? currentLoan.outstandingAmount,
      interestRate: updates.interestRate ?? currentLoan.interestRate,
      emi: updates.emi ?? currentLoan.emi,
      tenureMonths: updates.tenureMonths ?? currentLoan.tenureMonths,
      remainingMonths: updates.remainingMonths ?? currentLoan.remainingMonths,
      startDate: updates.startDate ?? currentLoan.startDate,
      endDate: updates.endDate ?? currentLoan.endDate,
      prepaymentAmount: updates.prepaymentAmount ?? currentLoan.prepaymentAmount,
      prepaymentFrequency: updates.prepaymentFrequency ?? currentLoan.prepaymentFrequency,
      status: updates.status ?? currentLoan.status,
      notes: updates.notes ?? currentLoan.notes,
    };

    assertValidLoan(merged);
    const updated = await updateLiability(mapLoanUpdatesToLiabilityUpdate(current, updates));
    return mapLiabilityToLoan(updated);
  }

  async deleteLoan(id: string): Promise<void> {
    await deleteLiability(id);
  }

  async archiveClosedLoan(id: string): Promise<Loan> {
    const updated = await updateLiability({ id, status: "closed" });
    return mapLiabilityToLoan(updated);
  }

  async getLoanSummary(): Promise<LoanSummary> {
    const loans = await this.listLoans();
    return buildLoanSummary(loans);
  }
}

export const loanManagementService = new LoanManagementService();

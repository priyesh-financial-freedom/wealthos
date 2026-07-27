import {
  DEFAULT_PROJECTION_SCENARIO_KEY,
  projectionEventsService,
} from "@/services/projection";
import { getInvestments } from "@/services/investments";
import { loanManagementService } from "@/services/loanManagement";
import type { FinancialEvent } from "@/types/projection";
import type { InvestmentCategory } from "@/types/investment";

export type IncomeType =
  | "Salary"
  | "Bonus"
  | "Rental Income"
  | "Interest"
  | "Dividend"
  | "Pension"
  | "Other";

export type ExpenseCategory =
  | "Household"
  | "Utilities"
  | "Insurance"
  | "Medical"
  | "Education"
  | "Travel"
  | "Other";

export type CashFlowStatus = "Active" | "Inactive";

export interface IncomeEntry {
  id: string;
  name: string;
  type: IncomeType;
  monthlyAmount: number;
  annualIncrement: number;
  startDate: string | null;
  status: CashFlowStatus;
  notes: string | null;
}

export interface ExpenseEntry {
  id: string;
  name: string;
  category: ExpenseCategory;
  monthlyAmount: number;
  annualInflation: number;
  startDate: string | null;
  status: CashFlowStatus;
  notes: string | null;
}

export type CommitmentSource = "Loan Management" | "Investment Management" | "Insurance" | "Goals";

export interface AutomaticCommitment {
  id: string;
  source: CommitmentSource;
  type: "EMI" | "SIP" | "PPF" | "NPS" | "EPF" | "Investment Contribution" | "Premium" | "Goal Funding";
  name: string;
  monthlyAmount: number;
  href: string;
}

export interface IncomeBreakdown {
  salary: number;
  bonusMonthlyEquivalent: number;
  rentalIncome: number;
  interestIncome: number;
  dividendOtherIncome: number;
  totalMonthlyIncome: number;
}

export interface CommitmentGroup {
  source: CommitmentSource;
  items: AutomaticCommitment[];
  subtotal: number;
}

export interface LivingExpenseRecord {
  id: string | null;
  monthlyAmount: number;
  notes: string | null;
}

export interface CashFlowSnapshot {
  incomeEntries: IncomeEntry[];
  manualExpenseEntries: ExpenseEntry[];
  automaticCommitments: AutomaticCommitment[];
  incomeBreakdown: IncomeBreakdown;
  commitmentGroups: CommitmentGroup[];
  livingExpense: LivingExpenseRecord;
  summary: CashFlowSummary;
}

export type IncomeCreateInput = Omit<IncomeEntry, "id">;
export type IncomeUpdateInput = Partial<Omit<IncomeEntry, "id">>;
export type ExpenseCreateInput = Omit<ExpenseEntry, "id">;
export type ExpenseUpdateInput = Partial<Omit<ExpenseEntry, "id">>;

export interface IncomeValidationIssue {
  field: keyof IncomeCreateInput;
  message: string;
}

export interface ExpenseValidationIssue {
  field: keyof ExpenseCreateInput;
  message: string;
}

export interface CashFlowSummary {
  monthlyIncome: number;
  monthlyAutomaticCommitments: number;
  monthlyManualExpenses: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
}

export interface CashFlowProjectionInput {
  income: Array<{ id: string; monthlyAmount: number; annualIncrement: number }>;
  expenses: Array<{ id: string; monthlyAmount: number; annualInflation: number }>;
}

type EntryKind = "income" | "expense";

interface CashFlowMetadata {
  entryKind?: EntryKind;
  incomeType?: IncomeType;
  expenseCategory?: string;
  annualIncrement?: number;
  annualInflation?: number;
  notes?: string;
}

const MANUAL_CATEGORY_SET = new Set<ExpenseCategory>([
  "Household",
  "Utilities",
  "Insurance",
  "Medical",
  "Education",
  "Travel",
  "Other",
]);

const COMMITMENT_CATEGORY_MAP: Partial<Record<InvestmentCategory, AutomaticCommitment["type"]>> = {
  PPF: "PPF",
  NPS: "NPS",
  EPF: "EPF",
  "Mutual Funds": "SIP",
};

export const MANUAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Household",
  "Utilities",
  "Insurance",
  "Medical",
  "Education",
  "Travel",
  "Other",
];

const FIXED_COMMITMENT_GROUP_ORDER: CommitmentSource[] = [
  "Loan Management",
  "Investment Management",
  "Insurance",
  "Goals",
];

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function monthKeyToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusFromEnabled(isEnabled: boolean): CashFlowStatus {
  return isEnabled ? "Active" : "Inactive";
}

function enabledFromStatus(status: CashFlowStatus): boolean {
  return status === "Active";
}

function isCashFlowEvent(event: FinancialEvent): boolean {
  return event.module === "cash-flow" && event.type === "cash-flow";
}

function metadataFor(event: FinancialEvent): CashFlowMetadata {
  return (event.metadata ?? {}) as CashFlowMetadata;
}

function toIncome(event: FinancialEvent): IncomeEntry {
  const metadata = metadataFor(event);
  return {
    id: event.id,
    name: event.name,
    type: metadata.incomeType ?? "Other",
    monthlyAmount: roundTwo(Math.max(0, toNumber(event.amount))),
    annualIncrement: clampPercent(toNumber(metadata.annualIncrement ?? 0)),
    startDate: event.startsOn ?? event.date ?? null,
    status: statusFromEnabled(Boolean(event.isEnabled)),
    notes: metadata.notes ?? null,
  };
}

function toManualExpense(event: FinancialEvent): ExpenseEntry | null {
  const metadata = metadataFor(event);
  const rawCategory = String(metadata.expenseCategory ?? "Other");
  const normalizedCategory = MANUAL_EXPENSE_CATEGORIES.find((item) => item === rawCategory) ?? null;

  if (!normalizedCategory) {
    return null;
  }

  return {
    id: event.id,
    name: event.name,
    category: normalizedCategory,
    monthlyAmount: roundTwo(Math.max(0, toNumber(event.amount))),
    annualInflation: clampPercent(toNumber(metadata.annualInflation ?? 0)),
    startDate: event.startsOn ?? event.date ?? null,
    status: statusFromEnabled(Boolean(event.isEnabled)),
    notes: metadata.notes ?? null,
  };
}

function toIncomeCreateEvent(input: IncomeCreateInput, scenarioKey: string) {
  return {
    scenarioKey,
    module: "cash-flow" as const,
    type: "cash-flow" as const,
    name: input.name,
    amount: roundTwo(Math.max(0, input.monthlyAmount)),
    date: input.startDate ?? monthKeyToday(),
    frequency: "monthly" as const,
    repeatEveryMonths: 1,
    startsOn: input.startDate,
    endsOn: null,
    isEnabled: enabledFromStatus(input.status),
    metadata: {
      entryKind: "income",
      incomeType: input.type,
      annualIncrement: clampPercent(input.annualIncrement),
      notes: input.notes ?? "",
    },
  };
}

function toExpenseCreateEvent(input: ExpenseCreateInput, scenarioKey: string) {
  return {
    scenarioKey,
    module: "cash-flow" as const,
    type: "cash-flow" as const,
    name: input.name,
    amount: roundTwo(Math.max(0, input.monthlyAmount)),
    date: input.startDate ?? monthKeyToday(),
    frequency: "monthly" as const,
    repeatEveryMonths: 1,
    startsOn: input.startDate,
    endsOn: null,
    isEnabled: enabledFromStatus(input.status),
    metadata: {
      entryKind: "expense",
      expenseCategory: input.category,
      annualInflation: clampPercent(input.annualInflation),
      notes: input.notes ?? "",
    },
  };
}

function toIncomeUpdateEvent(id: string, updates: IncomeUpdateInput) {
  const payload: Record<string, unknown> = { id };

  if (updates.name !== undefined) {
    payload.name = updates.name;
  }

  if (updates.monthlyAmount !== undefined) {
    payload.amount = roundTwo(Math.max(0, updates.monthlyAmount));
  }

  if (updates.startDate !== undefined) {
    payload.startsOn = updates.startDate;
    payload.date = updates.startDate ?? monthKeyToday();
  }

  if (updates.status !== undefined) {
    payload.isEnabled = enabledFromStatus(updates.status);
  }

  if (
    updates.type !== undefined
    || updates.annualIncrement !== undefined
    || updates.notes !== undefined
  ) {
    payload.metadata = {
      entryKind: "income",
      ...(updates.type !== undefined ? { incomeType: updates.type } : {}),
      ...(updates.annualIncrement !== undefined ? { annualIncrement: clampPercent(updates.annualIncrement) } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes ?? "" } : {}),
    };
  }

  return payload as {
    id: string;
    name?: string;
    amount?: number;
    date?: string;
    startsOn?: string | null;
    isEnabled?: boolean;
    metadata?: Record<string, unknown>;
  };
}

function toExpenseUpdateEvent(id: string, updates: ExpenseUpdateInput) {
  const payload: Record<string, unknown> = { id };

  if (updates.name !== undefined) {
    payload.name = updates.name;
  }

  if (updates.monthlyAmount !== undefined) {
    payload.amount = roundTwo(Math.max(0, updates.monthlyAmount));
  }

  if (updates.startDate !== undefined) {
    payload.startsOn = updates.startDate;
    payload.date = updates.startDate ?? monthKeyToday();
  }

  if (updates.status !== undefined) {
    payload.isEnabled = enabledFromStatus(updates.status);
  }

  if (
    updates.category !== undefined
    || updates.annualInflation !== undefined
    || updates.notes !== undefined
  ) {
    payload.metadata = {
      entryKind: "expense",
      ...(updates.category !== undefined ? { expenseCategory: updates.category } : {}),
      ...(updates.annualInflation !== undefined ? { annualInflation: clampPercent(updates.annualInflation) } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes ?? "" } : {}),
    };
  }

  return payload as {
    id: string;
    name?: string;
    amount?: number;
    date?: string;
    startsOn?: string | null;
    isEnabled?: boolean;
    metadata?: Record<string, unknown>;
  };
}

function assertValidIncome(input: IncomeCreateInput): void {
  const issues = validateIncome(input);
  if (issues.length === 0) {
    return;
  }

  throw new Error(issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | "));
}

function assertValidExpense(input: ExpenseCreateInput): void {
  const issues = validateExpense(input);
  if (issues.length === 0) {
    return;
  }

  throw new Error(issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | "));
}

function commitmentTypeForInvestmentCategory(category: InvestmentCategory): AutomaticCommitment["type"] {
  return COMMITMENT_CATEGORY_MAP[category] ?? "Investment Contribution";
}

function incomeBucket(type: IncomeType): keyof Omit<IncomeBreakdown, "totalMonthlyIncome"> {
  if (type === "Salary") {
    return "salary";
  }

  if (type === "Bonus") {
    return "bonusMonthlyEquivalent";
  }

  if (type === "Rental Income") {
    return "rentalIncome";
  }

  if (type === "Interest") {
    return "interestIncome";
  }

  return "dividendOtherIncome";
}

function buildIncomeBreakdown(entries: readonly IncomeEntry[]): IncomeBreakdown {
  const active = entries.filter((entry) => entry.status === "Active");
  const base: Omit<IncomeBreakdown, "totalMonthlyIncome"> = {
    salary: 0,
    bonusMonthlyEquivalent: 0,
    rentalIncome: 0,
    interestIncome: 0,
    dividendOtherIncome: 0,
  };

  for (const entry of active) {
    const key = incomeBucket(entry.type);
    base[key] += Math.max(0, entry.monthlyAmount);
  }

  const salary = roundTwo(base.salary);
  const bonusMonthlyEquivalent = roundTwo(base.bonusMonthlyEquivalent);
  const rentalIncome = roundTwo(base.rentalIncome);
  const interestIncome = roundTwo(base.interestIncome);
  const dividendOtherIncome = roundTwo(base.dividendOtherIncome);

  return {
    salary,
    bonusMonthlyEquivalent,
    rentalIncome,
    interestIncome,
    dividendOtherIncome,
    totalMonthlyIncome: roundTwo(salary + bonusMonthlyEquivalent + rentalIncome + interestIncome + dividendOtherIncome),
  };
}

function buildCommitmentGroups(items: readonly AutomaticCommitment[]): CommitmentGroup[] {
  return FIXED_COMMITMENT_GROUP_ORDER.map((source) => {
    const groupedItems = items.filter((item) => item.source === source);
    const subtotal = roundTwo(groupedItems.reduce((sum, item) => sum + Math.max(0, item.monthlyAmount), 0));

    return {
      source,
      items: groupedItems,
      subtotal,
    };
  });
}

function buildLivingExpenseRecord(entries: readonly ExpenseEntry[]): LivingExpenseRecord {
  if (entries.length === 0) {
    return {
      id: null,
      monthlyAmount: 0,
      notes: null,
    };
  }

  const activeEntries = entries.filter((entry) => entry.status === "Active");
  const primary = activeEntries[0] ?? entries[0];

  const monthlyAmount = roundTwo(
    activeEntries.reduce((sum, entry) => sum + Math.max(0, entry.monthlyAmount), 0),
  );

  const notesList = activeEntries
    .map((entry) => (entry.notes ?? "").trim())
    .filter((note) => note.length > 0);

  const notes = notesList.length > 0
    ? Array.from(new Set(notesList)).join(" | ")
    : (primary.notes ?? null);

  return {
    id: primary.id,
    monthlyAmount,
    notes,
  };
}

export function validateIncome(input: IncomeCreateInput): IncomeValidationIssue[] {
  const issues: IncomeValidationIssue[] = [];

  if (!String(input.name ?? "").trim()) {
    issues.push({ field: "name", message: "Name is required." });
  }

  if (toNumber(input.monthlyAmount) < 0) {
    issues.push({ field: "monthlyAmount", message: "Monthly amount must be greater than or equal to 0." });
  }

  const annualIncrement = toNumber(input.annualIncrement);
  if (annualIncrement < 0 || annualIncrement > 100) {
    issues.push({ field: "annualIncrement", message: "Annual increment must be between 0 and 100." });
  }

  return issues;
}

export function validateExpense(input: ExpenseCreateInput): ExpenseValidationIssue[] {
  const issues: ExpenseValidationIssue[] = [];

  if (!String(input.name ?? "").trim()) {
    issues.push({ field: "name", message: "Name is required." });
  }

  if (!MANUAL_CATEGORY_SET.has(input.category)) {
    issues.push({ field: "category", message: "Only manual expense categories are allowed." });
  }

  if (toNumber(input.monthlyAmount) < 0) {
    issues.push({ field: "monthlyAmount", message: "Monthly amount must be greater than or equal to 0." });
  }

  const annualInflation = toNumber(input.annualInflation);
  if (annualInflation < 0 || annualInflation > 100) {
    issues.push({ field: "annualInflation", message: "Annual inflation must be between 0 and 100." });
  }

  return issues;
}

export function buildCashFlowSummary(
  incomeEntries: readonly IncomeEntry[],
  manualExpenseEntries: readonly ExpenseEntry[],
  automaticCommitments: readonly AutomaticCommitment[],
): CashFlowSummary {
  const monthlyIncome = roundTwo(
    incomeEntries
      .filter((entry) => entry.status === "Active")
      .reduce((sum, entry) => sum + Math.max(0, entry.monthlyAmount), 0),
  );

  const monthlyManualExpenses = roundTwo(
    manualExpenseEntries
      .filter((entry) => entry.status === "Active")
      .reduce((sum, entry) => sum + Math.max(0, entry.monthlyAmount), 0),
  );

  const monthlyAutomaticCommitments = roundTwo(
    automaticCommitments.reduce((sum, item) => sum + Math.max(0, item.monthlyAmount), 0),
  );

  const monthlyExpenses = roundTwo(monthlyManualExpenses + monthlyAutomaticCommitments);
  const monthlySavings = roundTwo(monthlyIncome - monthlyExpenses);
  const savingsRate = monthlyIncome > 0 ? roundTwo(monthlySavings / monthlyIncome) : 0;

  return {
    monthlyIncome,
    monthlyAutomaticCommitments,
    monthlyManualExpenses,
    monthlyExpenses,
    monthlySavings,
    savingsRate,
  };
}

export function buildCashFlowProjectionInput(
  incomeEntries: readonly IncomeEntry[],
  manualExpenseEntries: readonly ExpenseEntry[],
): CashFlowProjectionInput {
  return {
    income: incomeEntries
      .filter((entry) => entry.status === "Active")
      .map((entry) => ({
        id: entry.id,
        monthlyAmount: roundTwo(Math.max(0, entry.monthlyAmount)),
        annualIncrement: clampPercent(entry.annualIncrement),
      })),
    expenses: manualExpenseEntries
      .filter((entry) => entry.status === "Active")
      .map((entry) => ({
        id: entry.id,
        monthlyAmount: roundTwo(Math.max(0, entry.monthlyAmount)),
        annualInflation: clampPercent(entry.annualInflation),
      })),
  };
}

export class CashFlowManagementService {
  async listIncome(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<IncomeEntry[]> {
    const events = await projectionEventsService.listEvents(scenarioKey);
    return events
      .filter((event) => isCashFlowEvent(event) && metadataFor(event).entryKind === "income")
      .map(toIncome);
  }

  async listManualExpenses(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<ExpenseEntry[]> {
    const events = await projectionEventsService.listEvents(scenarioKey);
    return events
      .filter((event) => isCashFlowEvent(event) && metadataFor(event).entryKind === "expense")
      .map(toManualExpense)
      .filter((entry): entry is ExpenseEntry => Boolean(entry));
  }

  async listAutomaticCommitments(): Promise<AutomaticCommitment[]> {
    const [loans, investments] = await Promise.all([
      loanManagementService.listLoans().catch(() => []),
      getInvestments().catch(() => []),
    ]);

    const loanCommitments: AutomaticCommitment[] = loans
      .filter((loan) => loan.status === "Active" && loan.outstandingAmount > 0 && loan.emi > 0)
      .map((loan) => ({
        id: `loan:${loan.id}:emi`,
        source: "Loan Management",
        type: "EMI",
        name: `${loan.name} EMI`,
        monthlyAmount: roundTwo(Math.max(0, loan.emi)),
        href: "/loans",
      }));

    const investmentCommitments: AutomaticCommitment[] = investments
      .filter((investment) => investment.status === "active")
      .map((investment) => {
        const monthlyAmount = roundTwo(Math.max(0, toNumber(investment.sip_amount ?? 0)));
        if (monthlyAmount <= 0) {
          return null;
        }

        const commitmentType = commitmentTypeForInvestmentCategory(investment.category);
        return {
          id: `investment:${investment.id}:contribution`,
          source: "Investment Management" as const,
          type: commitmentType,
          name: `${investment.investment_name} ${commitmentType}`,
          monthlyAmount,
          href: "/investments",
        } satisfies AutomaticCommitment;
      })
      .filter((entry): entry is AutomaticCommitment => Boolean(entry));

    return [...loanCommitments, ...investmentCommitments];
  }

  async addIncome(input: IncomeCreateInput, scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<IncomeEntry> {
    assertValidIncome(input);
    const created = await projectionEventsService.createEvent(toIncomeCreateEvent(input, scenarioKey));
    return toIncome(created);
  }

  async editIncome(id: string, updates: IncomeUpdateInput): Promise<IncomeEntry> {
    const existing = await this.listIncome();
    const current = existing.find((entry) => entry.id === id);
    if (!current) {
      throw new Error("Income not found.");
    }

    const merged: IncomeCreateInput = {
      name: updates.name ?? current.name,
      type: updates.type ?? current.type,
      monthlyAmount: updates.monthlyAmount ?? current.monthlyAmount,
      annualIncrement: updates.annualIncrement ?? current.annualIncrement,
      startDate: updates.startDate ?? current.startDate,
      status: updates.status ?? current.status,
      notes: updates.notes ?? current.notes,
    };

    assertValidIncome(merged);
    const updated = await projectionEventsService.updateEvent(toIncomeUpdateEvent(id, updates));
    return toIncome(updated);
  }

  async deleteIncome(id: string): Promise<void> {
    await projectionEventsService.deleteEvent(id);
  }

  async addExpense(input: ExpenseCreateInput, scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<ExpenseEntry> {
    assertValidExpense(input);
    const created = await projectionEventsService.createEvent(toExpenseCreateEvent(input, scenarioKey));
    const mapped = toManualExpense(created);

    if (!mapped) {
      throw new Error("Only manual expenses can be added from Cash Flow.");
    }

    return mapped;
  }

  async editExpense(id: string, updates: ExpenseUpdateInput): Promise<ExpenseEntry> {
    const existing = await this.listManualExpenses();
    const current = existing.find((entry) => entry.id === id);
    if (!current) {
      throw new Error("Manual expense not found.");
    }

    const merged: ExpenseCreateInput = {
      name: updates.name ?? current.name,
      category: updates.category ?? current.category,
      monthlyAmount: updates.monthlyAmount ?? current.monthlyAmount,
      annualInflation: updates.annualInflation ?? current.annualInflation,
      startDate: updates.startDate ?? current.startDate,
      status: updates.status ?? current.status,
      notes: updates.notes ?? current.notes,
    };

    assertValidExpense(merged);
    const updated = await projectionEventsService.updateEvent(toExpenseUpdateEvent(id, updates));
    const mapped = toManualExpense(updated);

    if (!mapped) {
      throw new Error("Only manual expenses can be updated from Cash Flow.");
    }

    return mapped;
  }

  async deleteExpense(id: string): Promise<void> {
    await projectionEventsService.deleteEvent(id);
  }

  async upsertLivingExpense(
    input: { monthlyAmount: number; notes?: string | null; status?: CashFlowStatus },
    scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY,
  ): Promise<LivingExpenseRecord> {
    const monthlyAmount = roundTwo(Math.max(0, toNumber(input.monthlyAmount)));
    const status = input.status ?? "Active";
    const notes = (input.notes ?? null) ? String(input.notes).trim() || null : null;

    const existing = await this.listManualExpenses(scenarioKey);

    if (existing.length === 0) {
      await this.addExpense({
        name: "Living Expenses",
        category: "Other",
        monthlyAmount,
        annualInflation: 0,
        startDate: monthKeyToday(),
        status,
        notes,
      }, scenarioKey);

      return {
        id: null,
        monthlyAmount,
        notes,
      };
    }

    const [primary, ...rest] = existing;

    await this.editExpense(primary.id, {
      name: "Living Expenses",
      category: "Other",
      monthlyAmount,
      annualInflation: 0,
      status,
      notes,
    });

    if (rest.length > 0) {
      await Promise.all(rest.map((entry) => this.deleteExpense(entry.id)));
    }

    return {
      id: primary.id,
      monthlyAmount,
      notes,
    };
  }

  // Backward-compatible alias for old callers.
  async listExpenses(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<ExpenseEntry[]> {
    return this.listManualExpenses(scenarioKey);
  }

  async getCashFlowSnapshot(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<CashFlowSnapshot> {
    const [incomeEntries, manualExpenseEntries, automaticCommitments] = await Promise.all([
      this.listIncome(scenarioKey),
      this.listManualExpenses(scenarioKey),
      this.listAutomaticCommitments(),
    ]);

    const incomeBreakdown = buildIncomeBreakdown(incomeEntries);
    const commitmentGroups = buildCommitmentGroups(automaticCommitments);
    const livingExpense = buildLivingExpenseRecord(manualExpenseEntries);

    return {
      incomeEntries,
      manualExpenseEntries,
      automaticCommitments,
      incomeBreakdown,
      commitmentGroups,
      livingExpense,
      summary: buildCashFlowSummary(incomeEntries, manualExpenseEntries, automaticCommitments),
    };
  }

  async getCashFlowSummary(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<CashFlowSummary> {
    const snapshot = await this.getCashFlowSnapshot(scenarioKey);
    return snapshot.summary;
  }

  async getProjectionInput(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<CashFlowProjectionInput> {
    const [incomeEntries, manualExpenseEntries] = await Promise.all([
      this.listIncome(scenarioKey),
      this.listManualExpenses(scenarioKey),
    ]);

    return buildCashFlowProjectionInput(incomeEntries, manualExpenseEntries);
  }
}

export const cashFlowManagementService = new CashFlowManagementService();

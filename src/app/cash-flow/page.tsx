"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Save } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import {
  cashFlowManagementService,
  type CashFlowSnapshot,
  type CashFlowSummary,
  type IncomeCreateInput,
  type IncomeEntry,
  type IncomeType,
} from "@/services/cashFlowManagement";

type IncomeFormState = IncomeCreateInput;

const emptySummary: CashFlowSummary = {
  monthlyIncome: 0,
  monthlyAutomaticCommitments: 0,
  monthlyManualExpenses: 0,
  monthlyExpenses: 0,
  monthlySavings: 0,
  savingsRate: 0,
};

const emptySnapshot: CashFlowSnapshot = {
  incomeEntries: [],
  manualExpenseEntries: [],
  automaticCommitments: [],
  incomeBreakdown: {
    salary: 0,
    bonusMonthlyEquivalent: 0,
    rentalIncome: 0,
    interestIncome: 0,
    dividendOtherIncome: 0,
    totalMonthlyIncome: 0,
  },
  commitmentGroups: [],
  livingExpense: {
    id: null,
    monthlyAmount: 0,
    notes: null,
  },
  summary: emptySummary,
};

const incomeTypeOptions: IncomeType[] = ["Salary", "Bonus", "Rental Income", "Interest", "Dividend", "Pension", "Other"];

const defaultIncomeForm: IncomeFormState = {
  name: "",
  type: "Salary",
  monthlyAmount: 0,
  annualIncrement: 0,
  startDate: null,
  status: "Active",
  notes: null,
};

function toNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: string): string | null {
  return value || null;
}

export default function CashFlowPage() {
  const [snapshot, setSnapshot] = useState<CashFlowSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(true);
  const [showCommitmentsBreakdown, setShowCommitmentsBreakdown] = useState(true);

  const [livingExpenseEditMode, setLivingExpenseEditMode] = useState(false);
  const [livingExpenseAmount, setLivingExpenseAmount] = useState(0);
  const [livingExpenseNotes, setLivingExpenseNotes] = useState("");

  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(defaultIncomeForm);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);

  const incomeById = useMemo(
    () => new Map(snapshot.incomeEntries.map((entry) => [entry.id, entry] as const)),
    [snapshot.incomeEntries],
  );

  const refreshCashFlow = useCallback(async () => {
    setError(null);

    try {
      const nextSnapshot = await cashFlowManagementService.getCashFlowSnapshot();
      setSnapshot(nextSnapshot);
      setLivingExpenseAmount(nextSnapshot.livingExpense.monthlyAmount);
      setLivingExpenseNotes(nextSnapshot.livingExpense.notes ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load cash flow data.");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      await refreshCashFlow();
      if (mounted) {
        setLoading(false);
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [refreshCashFlow]);

  function startAddIncome() {
    setEditingIncomeId(null);
    setIncomeForm(defaultIncomeForm);
  }

  function startEditIncome(entry: IncomeEntry) {
    setEditingIncomeId(entry.id);
    setIncomeForm({
      name: entry.name,
      type: entry.type,
      monthlyAmount: entry.monthlyAmount,
      annualIncrement: entry.annualIncrement,
      startDate: entry.startDate,
      status: entry.status,
      notes: entry.notes,
    });
  }

  async function saveIncome() {
    setSubmitting(true);
    setError(null);

    try {
      if (editingIncomeId) {
        await cashFlowManagementService.editIncome(editingIncomeId, incomeForm);
      } else {
        await cashFlowManagementService.addIncome(incomeForm);
      }

      setIncomeForm(defaultIncomeForm);
      setEditingIncomeId(null);
      await refreshCashFlow();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save income.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteIncome(id: string) {
    const target = incomeById.get(id);
    const confirmed = window.confirm(`Delete income \"${target?.name ?? "item"}\"?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await cashFlowManagementService.deleteIncome(id);
      await refreshCashFlow();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete income.");
    }
  }

  async function saveLivingExpense() {
    setSubmitting(true);
    setError(null);

    try {
      await cashFlowManagementService.upsertLivingExpense({
        monthlyAmount: livingExpenseAmount,
        notes: normalizeText(livingExpenseNotes),
        status: "Active",
      });

      setLivingExpenseEditMode(false);
      await refreshCashFlow();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save living expenses.");
    } finally {
      setSubmitting(false);
    }
  }

  const summary = snapshot.summary;

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Cash Flow"
          description="Single source of truth for monthly cash flow. Enter income and one living expense value; commitments are auto-sourced from modules."
        />

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {loading ? (
          <LoadingSpinner label="Loading cash flow..." />
        ) : (
          <div className="space-y-6">
            <ContentContainer>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Income</h2>
                  <p className="mt-1 text-sm text-slate-600">Complete visibility into monthly income sources.</p>
                </div>
                <p className="text-xl font-semibold text-emerald-700">{formatCurrency(summary.monthlyIncome, { maximumFractionDigits: 0 })}</p>
              </div>

              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                onClick={() => setShowIncomeBreakdown((current) => !current)}
              >
                {showIncomeBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showIncomeBreakdown ? "Hide breakdown" : "Show breakdown"}
              </button>

              {showIncomeBreakdown ? (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Salary</span>
                    <span className="font-medium">{formatCurrency(snapshot.incomeBreakdown.salary, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Bonus (Monthly Equivalent)</span>
                    <span className="font-medium">{formatCurrency(snapshot.incomeBreakdown.bonusMonthlyEquivalent, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Rental Income</span>
                    <span className="font-medium">{formatCurrency(snapshot.incomeBreakdown.rentalIncome, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Interest Income</span>
                    <span className="font-medium">{formatCurrency(snapshot.incomeBreakdown.interestIncome, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Dividend / Other Income</span>
                    <span className="font-medium">{formatCurrency(snapshot.incomeBreakdown.dividendOtherIncome, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="my-3 border-t border-dashed border-slate-300" />
                  <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                    <span>Total Monthly Income</span>
                    <span>{formatCurrency(snapshot.incomeBreakdown.totalMonthlyIncome, { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-700">Income entries</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Monthly</th>
                        <th className="px-3 py-2">Annual Increment</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {snapshot.incomeEntries.length === 0 ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>No income entries yet.</td>
                        </tr>
                      ) : (
                        snapshot.incomeEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-3 py-3">
                              <Link href="/income" className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                                {entry.name}
                              </Link>
                            </td>
                            <td className="px-3 py-3">{entry.type}</td>
                            <td className="px-3 py-3">{formatCurrency(entry.monthlyAmount, { maximumFractionDigits: 0 })}</td>
                            <td className="px-3 py-3">{formatPercent(entry.annualIncrement, { digits: 1, multiply: false })}</td>
                            <td className="px-3 py-3">{entry.status}</td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => startEditIncome(entry)}>
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => void deleteIncome(entry.id)}>
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">{editingIncomeId ? "Edit income" : "Add income"}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="income-name">Name</Label>
                      <Input id="income-name" value={incomeForm.name} onChange={(event) => setIncomeForm((current) => ({ ...current, name: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="income-type">Type</Label>
                      <select
                        id="income-type"
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                        value={incomeForm.type}
                        onChange={(event) => setIncomeForm((current) => ({ ...current, type: event.target.value as IncomeType }))}
                      >
                        {incomeTypeOptions.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="income-monthly">Monthly Amount</Label>
                      <Input id="income-monthly" type="number" min="0" step="0.01" value={incomeForm.monthlyAmount} onChange={(event) => setIncomeForm((current) => ({ ...current, monthlyAmount: toNumber(event.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="income-bonus">Annual Increment (%)</Label>
                      <Input id="income-bonus" type="number" min="0" max="100" step="0.1" value={incomeForm.annualIncrement} onChange={(event) => setIncomeForm((current) => ({ ...current, annualIncrement: toNumber(event.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="income-start">Start Date</Label>
                      <Input id="income-start" type="date" value={incomeForm.startDate ?? ""} onChange={(event) => setIncomeForm((current) => ({ ...current, startDate: normalizeDate(event.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="income-status">Status</Label>
                      <select
                        id="income-status"
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                        value={incomeForm.status}
                        onChange={(event) => setIncomeForm((current) => ({ ...current, status: event.target.value as "Active" | "Inactive" }))}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="income-notes">Notes</Label>
                      <Textarea id="income-notes" value={incomeForm.notes ?? ""} onChange={(event) => setIncomeForm((current) => ({ ...current, notes: normalizeText(event.target.value) }))} />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    {editingIncomeId ? (
                      <Button type="button" variant="outline" onClick={startAddIncome}>Cancel Edit</Button>
                    ) : null}
                    <Button type="button" disabled={submitting} onClick={() => void saveIncome()}>
                      <Save className="h-4 w-4" />
                      {submitting ? "Saving..." : editingIncomeId ? "Update Income" : "Add Income"}
                    </Button>
                  </div>
                </div>
              </div>
            </ContentContainer>

            <ContentContainer>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Automatic Commitments</h2>
                  <p className="mt-1 text-sm text-slate-600">Read-only monthly obligations sourced from linked modules.</p>
                </div>
                <p className="text-xl font-semibold text-amber-700">{formatCurrency(summary.monthlyAutomaticCommitments, { maximumFractionDigits: 0 })}</p>
              </div>

              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                onClick={() => setShowCommitmentsBreakdown((current) => !current)}
              >
                {showCommitmentsBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showCommitmentsBreakdown ? "Hide commitments" : "Show commitments"}
              </button>

              {showCommitmentsBreakdown ? (
                <div className="mt-4 space-y-4">
                  {snapshot.commitmentGroups.map((group) => (
                    <div key={group.source} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">{group.source}</h3>
                      <div className="mt-2 space-y-2">
                        {group.items.length === 0 ? (
                          <p className="text-sm text-slate-500">No commitments in this group.</p>
                        ) : (
                          group.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                              <Link href={item.href} className="text-slate-700 hover:text-blue-700 hover:underline">
                                {item.name}
                              </Link>
                              <span className="font-medium text-slate-900">{formatCurrency(item.monthlyAmount, { maximumFractionDigits: 0 })}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-3 border-t border-dashed border-slate-300 pt-3 text-sm font-semibold text-slate-900 flex items-center justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(group.subtotal, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-base font-semibold text-slate-900 flex items-center justify-between">
                    <span>Total Automatic Commitments</span>
                    <span>{formatCurrency(summary.monthlyAutomaticCommitments, { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              ) : null}
            </ContentContainer>

            <ContentContainer>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Living Expenses</h2>
                  <p className="mt-1 text-sm text-slate-600">Maintain one monthly living expense number with optional month note.</p>
                </div>
                {!livingExpenseEditMode ? (
                  <Button type="button" variant="outline" onClick={() => setLivingExpenseEditMode(true)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
              </div>

              <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-1">
                  <Label htmlFor="living-expense-amount">Monthly Living Expenses</Label>
                  <Input
                    id="living-expense-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!livingExpenseEditMode}
                    value={livingExpenseAmount}
                    onChange={(event) => setLivingExpenseAmount(toNumber(event.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="living-expense-notes">Notes (Optional)</Label>
                  <Textarea
                    id="living-expense-notes"
                    disabled={!livingExpenseEditMode}
                    value={livingExpenseNotes}
                    onChange={(event) => setLivingExpenseNotes(event.target.value)}
                    placeholder="Vacation during this month"
                  />
                </div>

                {livingExpenseEditMode ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setLivingExpenseEditMode(false);
                        setLivingExpenseAmount(snapshot.livingExpense.monthlyAmount);
                        setLivingExpenseNotes(snapshot.livingExpense.notes ?? "");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" disabled={submitting} onClick={() => void saveLivingExpense()}>
                      {submitting ? "Saving..." : "Save Living Expenses"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </ContentContainer>

            <ContentContainer>
              <h2 className="text-lg font-semibold text-slate-900">Savings</h2>
              <p className="mt-1 text-sm text-slate-600">Always calculated from the shared Cash Flow Summary service.</p>

              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span>Monthly Income</span>
                  <span className="font-medium">{formatCurrency(summary.monthlyIncome, { maximumFractionDigits: 0 })}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Less: Automatic Commitments</span>
                  <span className="font-medium">{formatCurrency(summary.monthlyAutomaticCommitments, { maximumFractionDigits: 0 })}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Less: Living Expenses</span>
                  <span className="font-medium">{formatCurrency(summary.monthlyManualExpenses, { maximumFractionDigits: 0 })}</span>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-3 flex items-center justify-between text-base font-semibold text-slate-900">
                  <span>Monthly Savings</span>
                  <span>{formatCurrency(summary.monthlySavings, { maximumFractionDigits: 0 })}</span>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-700">
                  <span>Savings Rate</span>
                  <span className="font-semibold">{formatPercent(summary.savingsRate, { digits: 1 })}</span>
                </div>
              </div>
            </ContentContainer>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}

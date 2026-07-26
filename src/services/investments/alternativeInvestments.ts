import { createInvestment, deleteInvestment, getInvestments, updateInvestment } from "@/services/investments";
import type { Investment, InvestmentInsert, InvestmentStatus, InvestmentUpdate } from "@/types/investment";

export const alternativeInvestmentCategories = [
  "PMS",
  "AIF",
  "REIT",
  "InvIT",
  "Venture Capital Fund",
  "Private Equity",
  "Art",
  "Collectibles",
  "Wine",
  "Watches",
  "Crypto",
  "Others",
] as const;

export type AlternativeInvestmentCategory = (typeof alternativeInvestmentCategories)[number];

export interface AlternativeInvestmentCreateInput {
  investment_name: string;
  category: AlternativeInvestmentCategory;
  invested_amount: number;
  current_value: number;
  purchase_date: string;
  owner: string;
  status?: InvestmentStatus;
  notes?: string | null;
  documents_placeholder?: string | null;
}

export interface AlternativeInvestmentUpdateInput extends Partial<AlternativeInvestmentCreateInput> {
  id: string;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function toInsertPayload(input: AlternativeInvestmentCreateInput): InvestmentInsert {
  const investmentName = input.investment_name.trim();
  const owner = input.owner.trim();

  if (!investmentName) throw new Error("Investment name is required.");
  if (!owner) throw new Error("Owner is required.");
  if (!input.purchase_date) throw new Error("Purchase date is required.");

  const investedAmount = Math.max(0, toNumber(input.invested_amount));
  const currentValue = Math.max(0, toNumber(input.current_value));

  return {
    category: "Other Investments",
    investment_type: "Other Investments",
    investment_name: investmentName,
    alternative_category: input.category,
    owner,
    acquisition_date: input.purchase_date,
    purchase_date: input.purchase_date,
    cost_value: investedAmount,
    cost_basis: investedAmount,
    current_value: currentValue,
    nav_price: investedAmount > 0 ? round2(currentValue / investedAmount) : 0,
    units: 1,
    today_gain_loss: round2(currentValue - investedAmount),
    status: input.status ?? "active",
    notes: input.notes ?? null,
    documents_placeholder: input.documents_placeholder ?? null,
  };
}

function toUpdatePayload(input: AlternativeInvestmentUpdateInput): InvestmentUpdate {
  const patch: InvestmentUpdate = {
    id: input.id,
    category: "Other Investments",
    investment_type: "Other Investments",
  };

  if (input.investment_name !== undefined) patch.investment_name = input.investment_name.trim();
  if (input.category !== undefined) patch.alternative_category = input.category;
  if (input.purchase_date !== undefined) {
    patch.acquisition_date = input.purchase_date;
    patch.purchase_date = input.purchase_date;
  }
  if (input.owner !== undefined) patch.owner = input.owner.trim() || null;
  if (input.invested_amount !== undefined) {
    const invested = Math.max(0, toNumber(input.invested_amount));
    patch.cost_value = invested;
    patch.cost_basis = invested;
  }
  if (input.current_value !== undefined) patch.current_value = Math.max(0, toNumber(input.current_value));
  if (input.invested_amount !== undefined || input.current_value !== undefined) {
    const invested = Math.max(0, toNumber(input.invested_amount ?? 0));
    const current = Math.max(0, toNumber(input.current_value ?? 0));
    patch.today_gain_loss = round2(current - invested);
    patch.nav_price = invested > 0 ? round2(current / invested) : 0;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.documents_placeholder !== undefined) patch.documents_placeholder = input.documents_placeholder;

  return patch;
}

export async function listAlternativeInvestments(): Promise<Investment[]> {
  const investments = await getInvestments();
  return investments.filter((item) => item.investment_type === "Other Investments");
}

export async function createAlternativeInvestment(input: AlternativeInvestmentCreateInput): Promise<Investment> {
  return createInvestment(toInsertPayload(input));
}

export async function updateAlternativeInvestment(input: AlternativeInvestmentUpdateInput): Promise<Investment> {
  const existing = (await listAlternativeInvestments()).find((item) => item.id === input.id);
  if (!existing) {
    throw new Error("Alternative investment not found.");
  }

  const mergedInvested = input.invested_amount ?? existing.cost_value ?? existing.cost_basis ?? 0;
  const mergedCurrent = input.current_value ?? existing.current_value ?? 0;

  return updateInvestment({
    ...toUpdatePayload(input),
    cost_value: Math.max(0, toNumber(mergedInvested)),
    cost_basis: Math.max(0, toNumber(mergedInvested)),
    current_value: Math.max(0, toNumber(mergedCurrent)),
    today_gain_loss: round2(Math.max(0, toNumber(mergedCurrent)) - Math.max(0, toNumber(mergedInvested))),
    nav_price: Math.max(0, toNumber(mergedInvested)) > 0
      ? round2(Math.max(0, toNumber(mergedCurrent)) / Math.max(0, toNumber(mergedInvested)))
      : 0,
  });
}

export async function deleteAlternativeInvestment(id: string): Promise<void> {
  await deleteInvestment(id);
}

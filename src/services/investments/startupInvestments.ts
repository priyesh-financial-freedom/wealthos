import { createInvestment, deleteInvestment, getInvestments, updateInvestment } from "@/services/investments";
import type { Investment, InvestmentInsert, InvestmentStatus, InvestmentUpdate } from "@/types/investment";

export interface StartupInvestmentCreateInput {
  startup_name: string;
  funding_round: string;
  investment_date: string;
  amount_invested: number;
  ownership_percent: number;
  current_estimated_value: number;
  owner: string;
  status?: InvestmentStatus;
  notes?: string | null;
  documents_placeholder?: string | null;
}

export interface StartupInvestmentUpdateInput extends Partial<StartupInvestmentCreateInput> {
  id: string;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function toInsertPayload(input: StartupInvestmentCreateInput): InvestmentInsert {
  const startupName = input.startup_name.trim();
  const owner = input.owner.trim();

  if (!startupName) throw new Error("Startup name is required.");
  if (!owner) throw new Error("Owner is required.");
  if (!input.investment_date) throw new Error("Investment date is required.");

  const amountInvested = Math.max(0, toNumber(input.amount_invested));
  const currentEstimatedValue = Math.max(0, toNumber(input.current_estimated_value));
  const ownershipPercent = Math.min(100, Math.max(0, toNumber(input.ownership_percent)));

  return {
    category: "Startup Investments",
    investment_type: "Startup Investments",
    investment_name: startupName,
    institution: startupName,
    owner,
    acquisition_date: input.investment_date,
    purchase_date: input.investment_date,
    startup_funding_round: input.funding_round.trim() || null,
    startup_ownership_percent: ownershipPercent,
    cost_value: amountInvested,
    cost_basis: amountInvested,
    current_value: currentEstimatedValue,
    nav_price: 0,
    units: 0,
    today_gain_loss: round2(currentEstimatedValue - amountInvested),
    status: input.status ?? "active",
    notes: input.notes ?? null,
    documents_placeholder: input.documents_placeholder ?? null,
  };
}

function toUpdatePayload(input: StartupInvestmentUpdateInput): InvestmentUpdate {
  const patch: InvestmentUpdate = {
    id: input.id,
    category: "Startup Investments",
    investment_type: "Startup Investments",
  };

  if (input.startup_name !== undefined) {
    patch.investment_name = input.startup_name.trim();
    patch.institution = input.startup_name.trim() || null;
  }
  if (input.owner !== undefined) patch.owner = input.owner.trim() || null;
  if (input.investment_date !== undefined) {
    patch.acquisition_date = input.investment_date;
    patch.purchase_date = input.investment_date;
  }
  if (input.funding_round !== undefined) patch.startup_funding_round = input.funding_round.trim() || null;
  if (input.ownership_percent !== undefined) patch.startup_ownership_percent = Math.min(100, Math.max(0, toNumber(input.ownership_percent)));
  if (input.amount_invested !== undefined) {
    const amountInvested = Math.max(0, toNumber(input.amount_invested));
    patch.cost_value = amountInvested;
    patch.cost_basis = amountInvested;
  }
  if (input.current_estimated_value !== undefined) {
    const value = Math.max(0, toNumber(input.current_estimated_value));
    patch.current_value = value;
  }
  if (input.amount_invested !== undefined || input.current_estimated_value !== undefined) {
    const invested = Math.max(0, toNumber(input.amount_invested ?? 0));
    const current = Math.max(0, toNumber(input.current_estimated_value ?? 0));
    patch.today_gain_loss = round2(current - invested);
    patch.nav_price = 0;
    patch.units = 0;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.documents_placeholder !== undefined) patch.documents_placeholder = input.documents_placeholder;

  return patch;
}

export async function listStartupInvestments(): Promise<Investment[]> {
  const investments = await getInvestments();
  return investments.filter((item) => item.investment_type === "Startup Investments");
}

export async function createStartupInvestment(input: StartupInvestmentCreateInput): Promise<Investment> {
  const payload = toInsertPayload(input);
  console.debug("[startup-investments] create payload", payload);
  return createInvestment(payload);
}

export async function updateStartupInvestment(input: StartupInvestmentUpdateInput): Promise<Investment> {
  const existing = (await listStartupInvestments()).find((item) => item.id === input.id);
  if (!existing) {
    throw new Error("Startup investment not found.");
  }

  const mergedAmountInvested = input.amount_invested ?? existing.cost_value ?? existing.cost_basis ?? 0;
  const mergedCurrentValue = input.current_estimated_value ?? existing.current_value ?? 0;

  const payload: InvestmentUpdate = {
    ...toUpdatePayload(input),
    cost_value: Math.max(0, toNumber(mergedAmountInvested)),
    cost_basis: Math.max(0, toNumber(mergedAmountInvested)),
    current_value: Math.max(0, toNumber(mergedCurrentValue)),
    today_gain_loss: round2(Math.max(0, toNumber(mergedCurrentValue)) - Math.max(0, toNumber(mergedAmountInvested))),
    nav_price: 0,
    units: 0,
  };

  console.debug("[startup-investments] update payload", payload);
  return updateInvestment(payload);
}

export async function deleteStartupInvestment(id: string): Promise<void> {
  await deleteInvestment(id);
}

import { createInvestment, deleteInvestment, getInvestments, updateInvestment } from "@/services/investments";
import type { Investment, InvestmentInsert, InvestmentStatus } from "@/types/investment";

export type GoldType =
  | "Physical Gold"
  | "Gold ETF"
  | "Gold Mutual Fund"
  | "Digital Gold"
  | "Gold Coin"
  | "Jewellery"
  | "Sovereign Gold Bond"
  | "Other";

export type GoldUnit = "Gram" | "Kilogram" | "Tola";

export interface GoldCreateInput {
  asset_name: string;
  gold_type: GoldType;
  quantity: number;
  unit: GoldUnit;
  purchase_price: number;
  current_value?: number | null;
  purchase_date: string;
  owner: string;
  storage_location?: string | null;
  status?: InvestmentStatus;
  documents_placeholder?: string | null;
  notes?: string | null;
}

export interface GoldUpdateInput extends Partial<GoldCreateInput> {
  id: string;
}

export interface GoldComputedValues {
  totalInvested: number;
  currentValue: number;
  gainLoss: number;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function toPositiveNumber(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

export function computeGoldValues(params: {
  quantity: number;
  purchasePrice: number;
  currentValue?: number | null;
}): GoldComputedValues {
  const quantity = toPositiveNumber(params.quantity);
  const purchasePrice = toPositiveNumber(params.purchasePrice);
  const totalInvested = round2(quantity * purchasePrice);
  const currentValue = params.currentValue === null || params.currentValue === undefined
    ? totalInvested
    : round2(toPositiveNumber(params.currentValue));

  return {
    totalInvested,
    currentValue,
    gainLoss: round2(currentValue - totalInvested),
  };
}

function toInsertPayload(input: GoldCreateInput): InvestmentInsert {
  const assetName = input.asset_name.trim();
  const owner = input.owner.trim();

  if (!assetName) {
    throw new Error("Asset name is required.");
  }
  if (!owner) {
    throw new Error("Owner is required.");
  }
  if (!input.purchase_date) {
    throw new Error("Purchase date is required.");
  }

  const computed = computeGoldValues({
    quantity: input.quantity,
    purchasePrice: input.purchase_price,
    currentValue: input.current_value,
  });

  const units = toPositiveNumber(input.quantity);
  const navPrice = units > 0 ? round2(computed.currentValue / units) : 0;

  return {
    investment_name: assetName,
    investment_type: "Gold",
    category: "Gold",
    owner,
    acquisition_date: input.purchase_date,
    purchase_date: input.purchase_date,
    units,
    average_purchase_price: toPositiveNumber(input.purchase_price),
    cost_value: computed.totalInvested,
    cost_basis: computed.totalInvested,
    current_value: computed.currentValue,
    nav_price: navPrice,
    today_gain_loss: computed.gainLoss,
    status: input.status ?? "active",
    notes: input.notes ?? null,
    documents_placeholder: input.documents_placeholder ?? null,
    gold_type: input.gold_type,
    gold_unit: input.unit,
    storage_location: input.storage_location ?? null,
  };
}

export async function listGoldHoldings(): Promise<Investment[]> {
  const investments = await getInvestments();
  return investments.filter((item) => item.investment_type === "Gold");
}

export async function createGoldHolding(input: GoldCreateInput): Promise<Investment> {
  return createInvestment(toInsertPayload(input));
}

export async function updateGoldHolding(input: GoldUpdateInput): Promise<Investment> {
  const holdings = await listGoldHoldings();
  const existing = holdings.find((item) => item.id === input.id);

  if (!existing) {
    throw new Error("Gold holding not found.");
  }

  const quantity = input.quantity ?? existing.units ?? 0;
  const purchasePrice = input.purchase_price ?? existing.average_purchase_price ?? existing.purchase_price ?? 0;
  const currentValue = input.current_value !== undefined ? input.current_value : existing.current_value;
  const purchaseDate = input.purchase_date ?? existing.purchase_date ?? existing.acquisition_date;
  const owner = input.owner ?? existing.owner ?? "";
  const assetName = input.asset_name ?? existing.investment_name;

  if (!purchaseDate) {
    throw new Error("Purchase date is required.");
  }

  const computed = computeGoldValues({
    quantity,
    purchasePrice,
    currentValue,
  });

  const normalizedQuantity = toPositiveNumber(quantity);

  return updateInvestment({
    id: input.id,
    investment_type: "Gold",
    category: "Gold",
    investment_name: assetName.trim(),
    owner: owner.trim(),
    acquisition_date: purchaseDate,
    purchase_date: purchaseDate,
    units: normalizedQuantity,
    average_purchase_price: toPositiveNumber(purchasePrice),
    cost_value: computed.totalInvested,
    cost_basis: computed.totalInvested,
    current_value: computed.currentValue,
    nav_price: normalizedQuantity > 0 ? round2(computed.currentValue / normalizedQuantity) : 0,
    today_gain_loss: computed.gainLoss,
    status: input.status ?? existing.status,
    notes: input.notes ?? existing.notes,
    documents_placeholder: input.documents_placeholder ?? existing.documents_placeholder,
    gold_type: input.gold_type ?? (existing.gold_type ?? "Other"),
    gold_unit: input.unit ?? (existing.gold_unit ?? "Gram"),
    storage_location: input.storage_location !== undefined ? input.storage_location : (existing.storage_location ?? null),
  });
}

export async function deleteGoldHolding(id: string): Promise<void> {
  await deleteInvestment(id);
}

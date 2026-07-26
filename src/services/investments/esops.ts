import { createInvestment, deleteInvestment, getInvestments, updateInvestment } from "@/services/investments";
import type { Investment, InvestmentInsert, InvestmentStatus, InvestmentUpdate } from "@/types/investment";

export type EsopGrantStatus = "Active" | "Fully Vested" | "Exercised" | "Expired";

export interface EsopCreateInput {
  company: string;
  grant_name: string;
  owner: string;
  grant_date: string;
  exercise_price: number;
  granted_shares: number;
  vested_shares: number;
  unvested_shares?: number;
  current_share_price?: number | null;
  grant_status: EsopGrantStatus;
  notes?: string | null;
  documents_placeholder?: string | null;
}

export interface EsopUpdateInput extends Partial<EsopCreateInput> {
  id: string;
}

export interface EsopDerivedValues {
  grantedShares: number;
  vestedShares: number;
  unvestedShares: number;
  currentValue: number;
  totalCostToExercise: number;
  vestedPercent: number;
  unvestedPercent: number;
  unrealizedGain: number;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function normalizeStatus(grantStatus: EsopGrantStatus): InvestmentStatus {
  if (grantStatus === "Exercised" || grantStatus === "Expired") {
    return "closed";
  }
  return "active";
}

export function computeEsopDerivedValues(params: {
  grantedShares: number;
  vestedShares: number;
  exercisePrice: number;
  currentSharePrice?: number | null;
}): EsopDerivedValues {
  const grantedShares = Math.max(0, toNumber(params.grantedShares));
  const vestedShares = Math.max(0, Math.min(grantedShares, toNumber(params.vestedShares)));
  const unvestedShares = Math.max(0, grantedShares - vestedShares);
  const exercisePrice = Math.max(0, toNumber(params.exercisePrice));
  const currentSharePrice = Math.max(0, params.currentSharePrice === null || params.currentSharePrice === undefined
    ? exercisePrice
    : toNumber(params.currentSharePrice));

  const currentValue = round2(vestedShares * currentSharePrice);
  const totalCostToExercise = round2(vestedShares * exercisePrice);
  const unrealizedGain = round2(currentValue - totalCostToExercise);
  const vestedPercent = grantedShares > 0 ? round2((vestedShares / grantedShares) * 100) : 0;
  const unvestedPercent = grantedShares > 0 ? round2((unvestedShares / grantedShares) * 100) : 0;

  return {
    grantedShares,
    vestedShares,
    unvestedShares,
    currentValue,
    totalCostToExercise,
    vestedPercent,
    unvestedPercent,
    unrealizedGain,
  };
}

function toInsertPayload(input: EsopCreateInput): InvestmentInsert {
  const company = input.company.trim();
  const grantName = input.grant_name.trim();
  const owner = input.owner.trim();

  if (!company) throw new Error("Company is required.");
  if (!grantName) throw new Error("Grant name is required.");
  if (!owner) throw new Error("Owner is required.");
  if (!input.grant_date) throw new Error("Grant date is required.");

  const derived = computeEsopDerivedValues({
    grantedShares: input.granted_shares,
    vestedShares: input.vested_shares,
    exercisePrice: input.exercise_price,
    currentSharePrice: input.current_share_price,
  });

  return {
    category: "ESOPs",
    investment_type: "ESOPs",
    investment_name: grantName,
    institution: company,
    owner,
    acquisition_date: input.grant_date,
    purchase_date: input.grant_date,
    units: derived.grantedShares,
    esop_vested_shares: derived.vestedShares,
    esop_current_share_price: input.current_share_price ?? null,
    esop_grant_status: input.grant_status,
    average_purchase_price: toNumber(input.exercise_price),
    purchase_price: toNumber(input.exercise_price),
    cost_value: derived.totalCostToExercise,
    cost_basis: derived.totalCostToExercise,
    current_value: derived.currentValue,
    nav_price: derived.grantedShares > 0 ? round2(derived.currentValue / derived.grantedShares) : 0,
    today_gain_loss: derived.unrealizedGain,
    status: normalizeStatus(input.grant_status),
    notes: input.notes ?? null,
    documents_placeholder: input.documents_placeholder ?? null,
  };
}

function toUpdatePayload(input: EsopUpdateInput): InvestmentUpdate {
  const patch: InvestmentUpdate = {
    id: input.id,
    category: "ESOPs",
    investment_type: "ESOPs",
  };

  if (input.company !== undefined) patch.institution = input.company.trim() || null;
  if (input.grant_name !== undefined) patch.investment_name = input.grant_name.trim();
  if (input.owner !== undefined) patch.owner = input.owner.trim() || null;
  if (input.grant_date !== undefined) {
    patch.acquisition_date = input.grant_date;
    patch.purchase_date = input.grant_date;
  }
  if (input.exercise_price !== undefined) {
    patch.average_purchase_price = toNumber(input.exercise_price);
    patch.purchase_price = toNumber(input.exercise_price);
  }
  if (input.granted_shares !== undefined) patch.units = Math.max(0, toNumber(input.granted_shares));
  if (input.vested_shares !== undefined) patch.esop_vested_shares = Math.max(0, toNumber(input.vested_shares));
  if (input.current_share_price !== undefined) patch.esop_current_share_price = input.current_share_price;
  if (input.grant_status !== undefined) {
    patch.esop_grant_status = input.grant_status;
    patch.status = normalizeStatus(input.grant_status);
  }
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.documents_placeholder !== undefined) patch.documents_placeholder = input.documents_placeholder;

  if (
    input.granted_shares !== undefined
    || input.vested_shares !== undefined
    || input.exercise_price !== undefined
    || input.current_share_price !== undefined
  ) {
    const derived = computeEsopDerivedValues({
      grantedShares: input.granted_shares ?? 0,
      vestedShares: input.vested_shares ?? 0,
      exercisePrice: input.exercise_price ?? 0,
      currentSharePrice: input.current_share_price,
    });
    patch.cost_value = derived.totalCostToExercise;
    patch.cost_basis = derived.totalCostToExercise;
    patch.current_value = derived.currentValue;
    patch.today_gain_loss = derived.unrealizedGain;
    patch.nav_price = derived.grantedShares > 0 ? round2(derived.currentValue / derived.grantedShares) : 0;
  }

  return patch;
}

export async function listEsops(): Promise<Investment[]> {
  const investments = await getInvestments();
  return investments.filter((item) => item.investment_type === "ESOPs");
}

export async function createEsop(input: EsopCreateInput): Promise<Investment> {
  return createInvestment(toInsertPayload(input));
}

export async function updateEsop(input: EsopUpdateInput): Promise<Investment> {
  const existing = (await listEsops()).find((item) => item.id === input.id);
  if (!existing) {
    throw new Error("ESOP grant not found.");
  }

  const merged = {
    company: input.company ?? existing.institution ?? "",
    grant_name: input.grant_name ?? existing.investment_name,
    owner: input.owner ?? existing.owner ?? "",
    grant_date: input.grant_date ?? existing.acquisition_date ?? existing.purchase_date ?? "",
    exercise_price: input.exercise_price ?? existing.average_purchase_price ?? existing.purchase_price ?? 0,
    granted_shares: input.granted_shares ?? existing.units ?? 0,
    vested_shares: input.vested_shares ?? existing.esop_vested_shares ?? 0,
    current_share_price: input.current_share_price !== undefined ? input.current_share_price : (existing.esop_current_share_price ?? null),
    grant_status: input.grant_status ?? (existing.esop_grant_status as EsopGrantStatus | null) ?? "Active",
  };

  const derived = computeEsopDerivedValues({
    grantedShares: merged.granted_shares,
    vestedShares: merged.vested_shares,
    exercisePrice: merged.exercise_price,
    currentSharePrice: merged.current_share_price,
  });

  const payload = toUpdatePayload({
    ...input,
    granted_shares: merged.granted_shares,
    vested_shares: merged.vested_shares,
    exercise_price: merged.exercise_price,
    current_share_price: merged.current_share_price,
    grant_status: merged.grant_status,
  });

  payload.cost_value = derived.totalCostToExercise;
  payload.cost_basis = derived.totalCostToExercise;
  payload.current_value = derived.currentValue;
  payload.today_gain_loss = derived.unrealizedGain;
  payload.nav_price = derived.grantedShares > 0 ? round2(derived.currentValue / derived.grantedShares) : 0;

  return updateInvestment(payload);
}

export async function deleteEsop(id: string): Promise<void> {
  await deleteInvestment(id);
}

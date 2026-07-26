import { createInvestment, deleteInvestment, getInvestments, updateInvestment } from "@/services/investments";
import type { Investment, InvestmentInsert, InvestmentStatus, InvestmentUpdate } from "@/types/investment";

export type BondType =
  | "Government Security (G-Sec)"
  | "Treasury Bill"
  | "State Development Loan (SDL)"
  | "PSU Bond"
  | "Corporate Bond"
  | "Tax Free Bond"
  | "RBI Floating Rate Bond"
  | "Sovereign Gold Bond"
  | "Municipal Bond"
  | "Other";

export type BondCouponFrequency = "Annual" | "Half-Yearly" | "Quarterly" | "Monthly";

export interface BondCreateInput {
  issuer: string;
  bond_name: string;
  bond_type: BondType;
  isin?: string | null;
  face_value: number;
  quantity: number;
  purchase_price: number;
  current_market_price?: number | null;
  coupon_rate: number;
  coupon_frequency: BondCouponFrequency;
  purchase_date: string;
  maturity_date: string;
  owner: string;
  broker?: string | null;
  status?: InvestmentStatus;
  notes?: string | null;
  documents_placeholder?: string | null;
}

export interface BondUpdateInput extends Partial<BondCreateInput> {
  id: string;
}

export interface BondBusinessKey {
  owner: string;
  isin: string | null;
  issuer: string;
  bond_name: string;
}

export interface BondDerivedValues {
  currentValue: number;
  totalInvested: number;
  unrealizedGainLoss: number;
  gainPercent: number;
  accruedInterest: number;
  annualCouponIncome: number;
  daysToMaturity: number;
  remainingTenure: string;
}

const BOND_COUPON_PERIODS: Record<BondCouponFrequency, number> = {
  Annual: 1,
  "Half-Yearly": 2,
  Quarterly: 4,
  Monthly: 12,
};

function round2(value: number) {
  return Number(value.toFixed(2));
}

function parseDateSafe(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function daysBetween(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeStatus(value: InvestmentStatus | undefined): InvestmentStatus {
  if (value === "inactive" || value === "closed") {
    return value;
  }

  return "active";
}

export function computeBondDerivedValues(params: {
  faceValue: number;
  quantity: number;
  purchasePrice: number;
  currentMarketPrice?: number | null;
  couponRate: number;
  couponFrequency: BondCouponFrequency;
  purchaseDate: string;
  maturityDate: string;
  asOfDate?: string;
}): BondDerivedValues {
  const faceValue = Math.max(0, Number(params.faceValue) || 0);
  const quantity = Math.max(0, Number(params.quantity) || 0);
  const purchasePrice = Math.max(0, Number(params.purchasePrice) || 0);
  const currentMarketPrice = params.currentMarketPrice === null || params.currentMarketPrice === undefined
    ? purchasePrice
    : Math.max(0, Number(params.currentMarketPrice) || 0);
  const couponRate = Math.max(0, Number(params.couponRate) || 0);

  const totalInvested = round2(quantity * purchasePrice);
  const currentValue = round2(quantity * currentMarketPrice);
  const unrealizedGainLoss = round2(currentValue - totalInvested);
  const gainPercent = totalInvested > 0 ? round2((unrealizedGainLoss / totalInvested) * 100) : 0;

  const annualCouponIncome = round2((faceValue * quantity * couponRate) / 100);

  const purchase = parseDateSafe(params.purchaseDate);
  const maturity = parseDateSafe(params.maturityDate);
  const asOf = parseDateSafe(params.asOfDate ?? new Date().toISOString().slice(0, 10)) ?? new Date();

  let accruedInterest = 0;
  let daysToMaturity = 0;
  let remainingTenure = "0d";

  if (purchase && maturity) {
    const effectiveAsOf = asOf.getTime() > maturity.getTime() ? maturity : asOf;
    const elapsedDays = Math.max(0, daysBetween(purchase, effectiveAsOf));
    accruedInterest = round2((annualCouponIncome / 365.25) * elapsedDays);

    daysToMaturity = Math.max(0, daysBetween(asOf, maturity));
    const years = Math.floor(daysToMaturity / 365);
    const months = Math.floor((daysToMaturity % 365) / 30);
    const days = Math.max(0, daysToMaturity - (years * 365) - (months * 30));
    remainingTenure = `${years}y ${months}m ${days}d`;

    const periods = BOND_COUPON_PERIODS[params.couponFrequency];
    if (periods > 0) {
      const couponPerPeriod = annualCouponIncome / periods;
      const daysPerPeriod = 365.25 / periods;
      const completedPeriods = Math.floor(elapsedDays / daysPerPeriod);
      const daysIntoCurrentPeriod = elapsedDays - Math.floor(completedPeriods * daysPerPeriod);
      accruedInterest = round2((couponPerPeriod / daysPerPeriod) * daysIntoCurrentPeriod);
    }
  }

  return {
    currentValue,
    totalInvested,
    unrealizedGainLoss,
    gainPercent,
    accruedInterest,
    annualCouponIncome,
    daysToMaturity,
    remainingTenure,
  };
}

function buildInvestmentInsert(input: BondCreateInput): InvestmentInsert {
  const issuer = input.issuer.trim();
  const bondName = input.bond_name.trim();
  const owner = input.owner.trim();

  if (!issuer) {
    throw new Error("Issuer is required.");
  }

  if (!bondName) {
    throw new Error("Bond name is required.");
  }

  if (!owner) {
    throw new Error("Owner is required.");
  }

  const derived = computeBondDerivedValues({
    faceValue: input.face_value,
    quantity: input.quantity,
    purchasePrice: input.purchase_price,
    currentMarketPrice: input.current_market_price,
    couponRate: input.coupon_rate,
    couponFrequency: input.coupon_frequency,
    purchaseDate: input.purchase_date,
    maturityDate: input.maturity_date,
  });

  return {
    category: "Bonds",
    investment_type: "Bonds",
    investment_name: bondName,
    institution: issuer,
    owner,
    broker: input.broker ?? null,
    isin: input.isin?.trim().toUpperCase() || null,
    acquisition_date: input.purchase_date,
    purchase_date: input.purchase_date,
    maturity_date: input.maturity_date,
    cost_value: derived.totalInvested,
    cost_basis: derived.totalInvested,
    current_value: derived.currentValue,
    units: input.quantity,
    nav_price: input.current_market_price ?? input.purchase_price,
    today_gain_loss: derived.unrealizedGainLoss,
    average_purchase_price: input.purchase_price,
    notes: input.notes ?? null,
    documents_placeholder: input.documents_placeholder ?? null,
    status: normalizeStatus(input.status),
    issuer,
    bond_name: bondName,
    bond_type: input.bond_type,
    face_value: input.face_value,
    coupon_rate: input.coupon_rate,
    coupon_frequency: input.coupon_frequency,
    purchase_price: input.purchase_price,
    current_market_price: input.current_market_price ?? input.purchase_price,
  };
}

function buildInvestmentUpdate(input: BondUpdateInput): InvestmentUpdate {
  const patch: InvestmentUpdate = {
    id: input.id,
    category: "Bonds",
    investment_type: "Bonds",
  };

  if (input.issuer !== undefined) {
    patch.issuer = input.issuer?.trim() || null;
    patch.institution = input.issuer?.trim() || null;
  }

  if (input.bond_name !== undefined) {
    patch.bond_name = input.bond_name?.trim() || null;
    patch.investment_name = input.bond_name?.trim() || "";
  }

  if (input.bond_type !== undefined) {
    patch.bond_type = input.bond_type;
  }

  if (input.isin !== undefined) {
    patch.isin = input.isin?.trim().toUpperCase() || null;
  }

  if (input.owner !== undefined) {
    patch.owner = input.owner?.trim() || null;
  }

  if (input.broker !== undefined) {
    patch.broker = input.broker?.trim() || null;
  }

  if (input.purchase_date !== undefined) {
    patch.acquisition_date = input.purchase_date;
    patch.purchase_date = input.purchase_date;
  }

  if (input.maturity_date !== undefined) {
    patch.maturity_date = input.maturity_date;
  }

  if (input.face_value !== undefined) {
    patch.face_value = input.face_value;
  }

  if (input.quantity !== undefined) {
    patch.units = input.quantity;
  }

  if (input.purchase_price !== undefined) {
    patch.purchase_price = input.purchase_price;
    patch.average_purchase_price = input.purchase_price;
  }

  if (input.current_market_price !== undefined) {
    patch.current_market_price = input.current_market_price;
    patch.nav_price = input.current_market_price ?? 0;
  }

  if (input.coupon_rate !== undefined) {
    patch.coupon_rate = input.coupon_rate;
  }

  if (input.coupon_frequency !== undefined) {
    patch.coupon_frequency = input.coupon_frequency;
  }

  if (input.status !== undefined) {
    patch.status = normalizeStatus(input.status);
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  if (input.documents_placeholder !== undefined) {
    patch.documents_placeholder = input.documents_placeholder;
  }

  const canRecompute =
    input.face_value !== undefined
    && input.quantity !== undefined
    && input.purchase_price !== undefined
    && input.coupon_rate !== undefined
    && input.coupon_frequency !== undefined
    && input.purchase_date !== undefined
    && input.maturity_date !== undefined;

  if (canRecompute) {
    const derived = computeBondDerivedValues({
      faceValue: Number(input.face_value ?? 0),
      quantity: Number(input.quantity ?? 0),
      purchasePrice: Number(input.purchase_price ?? 0),
      currentMarketPrice: input.current_market_price,
      couponRate: Number(input.coupon_rate ?? 0),
      couponFrequency: (input.coupon_frequency ?? "Annual") as BondCouponFrequency,
      purchaseDate: input.purchase_date ?? new Date().toISOString().slice(0, 10),
      maturityDate: input.maturity_date ?? input.purchase_date ?? new Date().toISOString().slice(0, 10),
    });

    patch.cost_value = derived.totalInvested;
    patch.cost_basis = derived.totalInvested;
    patch.current_value = derived.currentValue;
    patch.today_gain_loss = derived.unrealizedGainLoss;
  }

  return patch;
}

function matchBusinessKey(item: Investment, key: BondBusinessKey) {
  const owner = (item.owner ?? "").trim().toLowerCase();
  const isin = (item.isin ?? "").trim().toUpperCase();
  const issuer = (item.issuer ?? item.institution ?? "").trim().toLowerCase();
  const bondName = (item.bond_name ?? item.investment_name ?? "").trim().toLowerCase();

  const wantedOwner = key.owner.trim().toLowerCase();
  const wantedIsin = (key.isin ?? "").trim().toUpperCase();
  const wantedIssuer = key.issuer.trim().toLowerCase();
  const wantedBondName = key.bond_name.trim().toLowerCase();

  if (wantedIsin) {
    return owner === wantedOwner && isin === wantedIsin;
  }

  return owner === wantedOwner && issuer === wantedIssuer && bondName === wantedBondName;
}

export async function listBonds(): Promise<Investment[]> {
  const investments = await getInvestments();
  return investments.filter((item) => item.investment_type === "Bonds");
}

export async function getBondByBusinessKey(key: BondBusinessKey): Promise<Investment | null> {
  const bonds = await listBonds();
  return bonds.find((item) => matchBusinessKey(item, key)) ?? null;
}

export async function createBond(input: BondCreateInput): Promise<Investment> {
  return createInvestment(buildInvestmentInsert(input));
}

export async function updateBond(input: BondUpdateInput): Promise<Investment> {
  return updateInvestment(buildInvestmentUpdate(input));
}

export async function upsertBondByBusinessKey(params: {
  businessKey: BondBusinessKey;
  payload: Omit<BondCreateInput, "owner" | "isin" | "issuer" | "bond_name">;
}): Promise<Investment> {
  const existing = await getBondByBusinessKey(params.businessKey);

  if (existing) {
    return updateBond({
      id: existing.id,
      owner: params.businessKey.owner,
      isin: params.businessKey.isin,
      issuer: params.businessKey.issuer,
      bond_name: params.businessKey.bond_name,
      ...params.payload,
    });
  }

  return createBond({
    owner: params.businessKey.owner,
    isin: params.businessKey.isin,
    issuer: params.businessKey.issuer,
    bond_name: params.businessKey.bond_name,
    ...params.payload,
  });
}

export async function deleteBond(id: string): Promise<void> {
  await deleteInvestment(id);
}

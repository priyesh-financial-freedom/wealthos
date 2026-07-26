import { createInvestment, deleteInvestment, getInvestments, updateInvestment } from "@/services/investments";
import type { Investment, InvestmentInsert, InvestmentStatus, InvestmentUpdate } from "@/types/investment";

export type FdCompoundingFrequency = "monthly" | "quarterly" | "half-yearly" | "yearly";
export type FdPayoutType = "cumulative" | "monthly-payout" | "quarterly-payout" | "annual-payout";

export interface FixedDepositCreateInput {
  owner: string;
  institution: string;
  fd_number: string;
  principal: number;
  interest_rate: number;
  compounding_frequency: FdCompoundingFrequency;
  payout_type: FdPayoutType;
  start_date: string;
  maturity_date: string;
  status?: InvestmentStatus;
  notes?: string | null;
  documents_placeholder?: string | null;
  investment_name?: string | null;
}

export interface FixedDepositUpdateInput extends Partial<FixedDepositCreateInput> {
  id: string;
}

export interface FixedDepositBusinessKey {
  owner: string;
  institution: string;
  fd_number: string;
}

export interface FixedDepositComputedValues {
  currentValue: number;
  accruedInterest: number;
  maturityValue: number;
}

function normalizeFrequency(value: string | null | undefined): FdCompoundingFrequency {
  if (value === "monthly" || value === "quarterly" || value === "half-yearly" || value === "yearly") {
    return value;
  }

  return "quarterly";
}

function normalizePayoutType(value: string | null | undefined): FdPayoutType {
  if (value === "cumulative" || value === "monthly-payout" || value === "quarterly-payout" || value === "annual-payout") {
    return value;
  }

  return "cumulative";
}

function periodsPerYear(frequency: FdCompoundingFrequency) {
  if (frequency === "monthly") {
    return 12;
  }

  if (frequency === "quarterly") {
    return 4;
  }

  if (frequency === "half-yearly") {
    return 2;
  }

  return 1;
}

function dayDiff(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function yearsBetween(start: Date, end: Date) {
  return dayDiff(start, end) / 365.25;
}

function toDateOrToday(value: string | null | undefined) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

export function computeFixedDepositValues(params: {
  principal: number;
  annualInterestRatePercent: number;
  compoundingFrequency: FdCompoundingFrequency;
  payoutType: FdPayoutType;
  startDate: string;
  maturityDate: string;
  asOfDate?: string;
}): FixedDepositComputedValues {
  const principal = Math.max(0, Number(params.principal) || 0);
  const annualRate = Math.max(0, Number(params.annualInterestRatePercent) || 0) / 100;
  const start = toDateOrToday(params.startDate);
  const maturity = toDateOrToday(params.maturityDate);
  const asOf = toDateOrToday(params.asOfDate);

  const effectiveAsOf = asOf.getTime() > maturity.getTime() ? maturity : asOf;
  const elapsedYears = yearsBetween(start, effectiveAsOf);
  const fullTenureYears = yearsBetween(start, maturity);

  if (params.payoutType === "cumulative") {
    const n = periodsPerYear(params.compoundingFrequency);
    const maturityValue = principal * Math.pow(1 + annualRate / n, n * fullTenureYears);
    const currentValue = principal * Math.pow(1 + annualRate / n, n * elapsedYears);

    return {
      currentValue: round2(currentValue),
      accruedInterest: round2(currentValue - principal),
      maturityValue: round2(maturityValue),
    };
  }

  const accruedInterest = principal * annualRate * elapsedYears;
  return {
    currentValue: round2(principal),
    accruedInterest: round2(accruedInterest),
    maturityValue: round2(principal),
  };
}

function assertBusinessKey(input: FixedDepositBusinessKey) {
  const owner = input.owner.trim();
  const institution = input.institution.trim();
  const fdNumber = input.fd_number.trim();

  if (!owner || !institution || !fdNumber) {
    throw new Error("Owner, institution, and FD number are required for fixed deposit identity.");
  }

  return {
    owner,
    institution,
    fd_number: fdNumber,
  };
}

function normalizeStatus(value: InvestmentStatus | undefined): InvestmentStatus {
  if (value === "inactive" || value === "closed") {
    return value;
  }

  return "active";
}

function toInvestmentPayload(input: FixedDepositCreateInput): InvestmentInsert {
  const owner = input.owner.trim();
  const institution = input.institution.trim();
  const fdNumber = input.fd_number.trim();

  if (!owner) {
    throw new Error("Owner is required.");
  }

  if (!institution) {
    throw new Error("Institution is required.");
  }

  if (!fdNumber) {
    throw new Error("FD number is required.");
  }

  if (!input.start_date) {
    throw new Error("Start date is required.");
  }

  if (!input.maturity_date) {
    throw new Error("Maturity date is required.");
  }

  const computed = computeFixedDepositValues({
    principal: Number(input.principal),
    annualInterestRatePercent: Number(input.interest_rate),
    compoundingFrequency: normalizeFrequency(input.compounding_frequency),
    payoutType: normalizePayoutType(input.payout_type),
    startDate: input.start_date,
    maturityDate: input.maturity_date,
  });

  return {
    investment_name: input.investment_name?.trim() || `${institution} FD ${fdNumber}`,
    category: "Fixed Deposits",
    investment_type: "Fixed Deposits",
    owner,
    institution,
    acquisition_date: input.start_date,
    purchase_date: input.start_date,
    cost_value: Number(input.principal),
    cost_basis: Number(input.principal),
    current_value: computed.currentValue,
    units: 1,
    nav_price: computed.currentValue,
    today_gain_loss: computed.accruedInterest,
    status: normalizeStatus(input.status),
    notes: input.notes ?? null,
    documents_placeholder: input.documents_placeholder ?? null,
    fd_number: fdNumber,
    interest_rate: Number(input.interest_rate),
    compounding_frequency: normalizeFrequency(input.compounding_frequency),
    payout_type: normalizePayoutType(input.payout_type),
    maturity_date: input.maturity_date,
    maturity_value: computed.maturityValue,
  };
}

function toInvestmentUpdatePayload(input: FixedDepositUpdateInput): InvestmentUpdate {
  const patch: InvestmentUpdate = {
    id: input.id,
    category: "Fixed Deposits",
    investment_type: "Fixed Deposits",
  };

  const owner = input.owner?.trim();
  const institution = input.institution?.trim();
  const fdNumber = input.fd_number?.trim();

  if (input.owner !== undefined) {
    patch.owner = owner || null;
  }

  if (input.institution !== undefined) {
    patch.institution = institution || null;
  }

  if (input.fd_number !== undefined) {
    patch.fd_number = fdNumber || null;
  }

  if (input.interest_rate !== undefined) {
    patch.interest_rate = Number(input.interest_rate);
  }

  if (input.compounding_frequency !== undefined) {
    patch.compounding_frequency = normalizeFrequency(input.compounding_frequency);
  }

  if (input.payout_type !== undefined) {
    patch.payout_type = normalizePayoutType(input.payout_type);
  }

  if (input.start_date !== undefined) {
    patch.acquisition_date = input.start_date;
    patch.purchase_date = input.start_date;
  }

  if (input.maturity_date !== undefined) {
    patch.maturity_date = input.maturity_date;
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

  if (input.investment_name !== undefined) {
    patch.investment_name = input.investment_name?.trim() || "";
  }

  const hasRateInputs =
    input.principal !== undefined ||
    input.interest_rate !== undefined ||
    input.compounding_frequency !== undefined ||
    input.payout_type !== undefined ||
    input.start_date !== undefined ||
    input.maturity_date !== undefined;

  if (hasRateInputs) {
    const principal = Number(input.principal ?? 0);
    const interestRate = Number(input.interest_rate ?? 0);
    const compoundingFrequency = normalizeFrequency(input.compounding_frequency);
    const payoutType = normalizePayoutType(input.payout_type);
    const startDate = input.start_date ?? new Date().toISOString().slice(0, 10);
    const maturityDate = input.maturity_date ?? startDate;

    const computed = computeFixedDepositValues({
      principal,
      annualInterestRatePercent: interestRate,
      compoundingFrequency,
      payoutType,
      startDate,
      maturityDate,
    });

    patch.cost_value = principal;
    patch.cost_basis = principal;
    patch.current_value = computed.currentValue;
    patch.nav_price = computed.currentValue;
    patch.units = 1;
    patch.today_gain_loss = computed.accruedInterest;
    patch.maturity_value = computed.maturityValue;
  }

  return patch;
}

export async function listFixedDeposits(): Promise<Investment[]> {
  const investments = await getInvestments();
  return investments.filter((item) => item.investment_type === "Fixed Deposits");
}

export async function getFixedDepositByBusinessKey(key: FixedDepositBusinessKey): Promise<Investment | null> {
  const normalized = assertBusinessKey(key);
  const items = await listFixedDeposits();

  return items.find((item) => {
    return (
      (item.owner ?? "").trim().toLowerCase() === normalized.owner.toLowerCase()
      && (item.institution ?? "").trim().toLowerCase() === normalized.institution.toLowerCase()
      && (item.fd_number ?? "").trim().toLowerCase() === normalized.fd_number.toLowerCase()
    );
  }) ?? null;
}

export async function createFixedDepositHolding(input: FixedDepositCreateInput): Promise<Investment> {
  return createInvestment(toInvestmentPayload(input));
}

export async function updateFixedDepositHolding(input: FixedDepositUpdateInput): Promise<Investment> {
  return updateInvestment(toInvestmentUpdatePayload(input));
}

export async function upsertFixedDepositByBusinessKey(params: {
  businessKey: FixedDepositBusinessKey;
  payload: Omit<FixedDepositCreateInput, "owner" | "institution" | "fd_number">;
}): Promise<Investment> {
  const businessKey = assertBusinessKey(params.businessKey);
  const existing = await getFixedDepositByBusinessKey(businessKey);

  if (existing) {
    return updateFixedDepositHolding({
      id: existing.id,
      owner: businessKey.owner,
      institution: businessKey.institution,
      fd_number: businessKey.fd_number,
      ...params.payload,
    });
  }

  return createFixedDepositHolding({
    owner: businessKey.owner,
    institution: businessKey.institution,
    fd_number: businessKey.fd_number,
    ...params.payload,
  });
}

export async function deleteFixedDepositHolding(id: string): Promise<void> {
  await deleteInvestment(id);
}

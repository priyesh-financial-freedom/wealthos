import { getLiabilities } from "@/services/liabilities";

/**
 * Versioned policy contract for Financial Position liability aggregation.
 *
 * v1.0 rules:
 * - include rows with outstanding_amount > 0
 * - include all liability types
 * - include all statuses except Archived
 * - exclude deleted records
 */
export const FINANCIAL_POSITION_POLICY_VERSION = "1.0" as const;

export type FinancialPositionPolicyVersion = typeof FINANCIAL_POSITION_POLICY_VERSION;

export type LiabilityPortfolioBucket =
  | "home_loans"
  | "vehicle_loans"
  | "credit_cards"
  | "personal_loans"
  | "other_liabilities";

export type LiabilityExclusionReason =
  | "zero_or_negative_outstanding"
  | "archived"
  | "deleted";

export interface LiabilityDomainRow {
  id: string;
  user_id: string;
  account_name?: string | null;
  name?: string | null;
  liability_type?: string | null;
  category?: string | null;
  status?: string | null;
  outstanding_amount?: number | string | null;
  current_balance?: number | string | null;
  original_amount?: number | string | null;
  interest_rate?: number | string | null;
  emi?: number | string | null;
  deleted?: boolean | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  archived?: boolean | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LiabilityDomainRepository {
  /**
   * Returns the raw liability rows evaluated by the Financial Position policy.
   */
  listLiabilities(): Promise<readonly LiabilityDomainRow[]>;
}

export interface LiabilityAggregationItem {
  key: string;
  label: string;
  outstandingAmount: number;
  monthlyEmi: number;
  liabilityCount: number;
  activeLiabilityCount: number;
  weightedAverageInterest: number | null;
  shareOfTotalOutstanding: number;
}

export interface LargestLiabilityItem {
  id: string;
  userId: string;
  liabilityType: string;
  bucket: LiabilityPortfolioBucket;
  status: string;
  outstandingAmount: number;
  originalAmount: number | null;
  interestRate: number | null;
  emi: number;
  shareOfTotalOutstanding: number;
}

export interface FinancialPositionBreakdown {
  breakdownByLiabilityType: LiabilityAggregationItem[];
  breakdownByPortfolioBucket: LiabilityAggregationItem[];
  breakdownByStatus: LiabilityAggregationItem[];
}

export interface FinancialPositionInspectionRow {
  id: string;
  userId: string;
  label: string;
  liabilityType: string;
  bucket: LiabilityPortfolioBucket;
  status: string;
  outstandingAmount: number;
  monthlyEmi: number;
  interestRate: number | null;
  originalAmount: number | null;
}

export interface LiabilityDiagnosticsExclusion {
  id: string;
  reasons: LiabilityExclusionReason[];
}

export interface LiabilityDiagnosticsReasonBreakdown {
  reason: LiabilityExclusionReason;
  count: number;
  liabilityIds: string[];
}

export interface LiabilityDiagnostics {
  databaseRowCount: number;
  includedRowCount: number;
  excludedRowCount: number;
  exclusionReasons: LiabilityDiagnosticsReasonBreakdown[];
  excludedRows: LiabilityDiagnosticsExclusion[];
}

export interface FinancialPositionSnapshot extends FinancialPositionBreakdown {
  policyVersion: FinancialPositionPolicyVersion;
  asOf: string;
  databaseRowCount: number;
  includedRowCount: number;
  excludedRowCount: number;
  totalOutstanding: number;
  totalMonthlyEmi: number;
  weightedAverageInterest: number | null;
  liabilityCount: number;
  activeLiabilityCount: number;
  largestLiability: LargestLiabilityItem | null;
  top3Share: number;
  herfindahlIndex: number;
}

export interface FinancialPositionValidationCheck {
  name: string;
  passed: boolean;
  expected: number | null;
  actual: number | null;
  message: string;
}

export interface FinancialPositionValidationResult {
  valid: boolean;
  snapshot: FinancialPositionSnapshot;
  checks: FinancialPositionValidationCheck[];
}

export interface FinancialPositionInspection {
  snapshot: FinancialPositionSnapshot;
  diagnostics: LiabilityDiagnostics;
  includedRows: FinancialPositionInspectionRow[];
}

interface LiabilityCoreMetrics {
  outstandingAmount: number;
  monthlyEmi: number;
  interestRate: number | null;
  status: string;
  liabilityType: string;
  bucket: LiabilityPortfolioBucket;
}

interface AggregationTotals {
  outstandingAmount: number;
  monthlyEmi: number;
  interestWeightedNumerator: number;
  interestWeightedDenominator: number;
  liabilityCount: number;
  activeLiabilityCount: number;
}

interface AggregationState {
  byLiabilityType: Map<string, AggregationTotals>;
  byPortfolioBucket: Map<LiabilityPortfolioBucket, AggregationTotals>;
  byStatus: Map<string, AggregationTotals>;
  largestLiability: LargestLiabilityItem | null;
  topLiabilities: LargestLiabilityItem[];
  totalOutstanding: number;
  totalMonthlyEmi: number;
  totalWeightedInterestNumerator: number;
  totalWeightedInterestDenominator: number;
  totalLiabilityCount: number;
  totalActiveLiabilityCount: number;
  includedRowCount: number;
  includedRows: FinancialPositionInspectionRow[];
  excludedRows: LiabilityDiagnosticsExclusion[];
  exclusionReasonMap: Map<LiabilityExclusionReason, Set<string>>;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown): string {
  return normalizeText(value) || "unknown";
}

function resolveOutstandingAmount(row: LiabilityDomainRow): number {
  return toNumber(row.outstanding_amount ?? row.current_balance ?? 0);
}

function resolveEmi(row: LiabilityDomainRow): number {
  return toNumber(row.emi ?? 0);
}

function resolveInterestRate(row: LiabilityDomainRow): number | null {
  const value = row.interest_rate;
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveLiabilityType(row: LiabilityDomainRow): string {
  return normalizeText(row.liability_type ?? row.category) || "Unclassified Liability";
}

function resolveBucket(liabilityType: string): LiabilityPortfolioBucket {
  switch (liabilityType) {
    case "Home Loan":
    case "Loan Against Property":
      return "home_loans";
    case "Car Loan":
      return "vehicle_loans";
    case "Credit Card":
      return "credit_cards";
    case "Personal Loan":
    case "Bank Overdraft":
    case "Overdraft / Line of Credit":
      return "personal_loans";
    case "Education Loan":
    case "Other Liability":
    default:
      return "other_liabilities";
  }
}

function isArchived(row: LiabilityDomainRow): boolean {
  const status = normalizeStatus(row.status).toLowerCase();
  return status === "archived" || Boolean(row.archived) || Boolean(row.archived_at);
}

function isDeleted(row: LiabilityDomainRow): boolean {
  const status = normalizeStatus(row.status).toLowerCase();
  return status === "deleted" || Boolean(row.deleted) || Boolean(row.is_deleted) || Boolean(row.deleted_at);
}

function shouldIncludeRow(row: LiabilityDomainRow): { included: boolean; reasons: LiabilityExclusionReason[] } {
  const reasons: LiabilityExclusionReason[] = [];
  const outstandingAmount = resolveOutstandingAmount(row);

  if (!(outstandingAmount > 0)) {
    reasons.push("zero_or_negative_outstanding");
  }

  if (isArchived(row)) {
    reasons.push("archived");
  }

  if (isDeleted(row)) {
    reasons.push("deleted");
  }

  return {
    included: reasons.length === 0,
    reasons,
  };
}

function createAggregationTotals(): AggregationTotals {
  return {
    outstandingAmount: 0,
    monthlyEmi: 0,
    interestWeightedNumerator: 0,
    interestWeightedDenominator: 0,
    liabilityCount: 0,
    activeLiabilityCount: 0,
  };
}

function updateAggregationTotals(totals: AggregationTotals, metrics: LiabilityCoreMetrics): void {
  totals.outstandingAmount += metrics.outstandingAmount;
  totals.monthlyEmi += metrics.monthlyEmi;
  totals.liabilityCount += 1;

  if (metrics.status.toLowerCase() === "active") {
    totals.activeLiabilityCount += 1;
  }

  if (metrics.interestRate !== null) {
    totals.interestWeightedNumerator += metrics.outstandingAmount * metrics.interestRate;
    totals.interestWeightedDenominator += metrics.outstandingAmount;
  }
}

function weightedAverageInterest(totals: AggregationTotals): number | null {
  if (totals.interestWeightedDenominator <= 0) {
    return null;
  }

  return roundMoney(totals.interestWeightedNumerator / totals.interestWeightedDenominator);
}

function toAggregationItems<T extends string>(
  map: Map<T, AggregationTotals>,
  labelFor: (key: T) => string,
  totalOutstanding: number,
): LiabilityAggregationItem[] {
  return [...map.entries()]
    .map(([key, totals]) => ({
      key,
      label: labelFor(key),
      outstandingAmount: roundMoney(totals.outstandingAmount),
      monthlyEmi: roundMoney(totals.monthlyEmi),
      liabilityCount: totals.liabilityCount,
      activeLiabilityCount: totals.activeLiabilityCount,
      weightedAverageInterest: weightedAverageInterest(totals),
      shareOfTotalOutstanding: totalOutstanding > 0 ? roundMoney(totals.outstandingAmount / totalOutstanding) : 0,
    }))
    .sort((left, right) => right.outstandingAmount - left.outstandingAmount || left.label.localeCompare(right.label));
}

function mapReasonSet(reasonMap: Map<LiabilityExclusionReason, Set<string>>): LiabilityDiagnosticsReasonBreakdown[] {
  return [...reasonMap.entries()].map(([reason, liabilityIds]) => ({
    reason,
    count: liabilityIds.size,
    liabilityIds: [...liabilityIds].sort(),
  }));
}

function bucketLabel(bucket: LiabilityPortfolioBucket): string {
  switch (bucket) {
    case "home_loans":
      return "Home Loans";
    case "vehicle_loans":
      return "Vehicle Loans";
    case "credit_cards":
      return "Credit Cards";
    case "personal_loans":
      return "Personal Loans";
    case "other_liabilities":
      return "Other Liabilities";
  }
}

function createState(): AggregationState {
  return {
    byLiabilityType: new Map(),
    byPortfolioBucket: new Map(),
    byStatus: new Map(),
    largestLiability: null,
    topLiabilities: [],
    totalOutstanding: 0,
    totalMonthlyEmi: 0,
    totalWeightedInterestNumerator: 0,
    totalWeightedInterestDenominator: 0,
    totalLiabilityCount: 0,
    totalActiveLiabilityCount: 0,
    includedRowCount: 0,
    includedRows: [],
    excludedRows: [],
    exclusionReasonMap: new Map<LiabilityExclusionReason, Set<string>>([
      ["zero_or_negative_outstanding", new Set<string>()],
      ["archived", new Set<string>()],
      ["deleted", new Set<string>()],
    ]),
  };
}

function appendExclusionReasons(state: AggregationState, row: LiabilityDomainRow, reasons: LiabilityExclusionReason[]): void {
  if (reasons.length === 0) {
    return;
  }

  state.excludedRows.push({
    id: row.id,
    reasons,
  });

  for (const reason of reasons) {
    state.exclusionReasonMap.get(reason)?.add(row.id);
  }
}

function registerIncludedRow(state: AggregationState, row: LiabilityDomainRow): void {
  const liabilityType = resolveLiabilityType(row);
  const bucket = resolveBucket(liabilityType);
  const status = normalizeStatus(row.status);
  const outstandingAmount = resolveOutstandingAmount(row);
  const monthlyEmi = resolveEmi(row);
  const interestRate = resolveInterestRate(row);
  const coreMetrics: LiabilityCoreMetrics = {
    outstandingAmount,
    monthlyEmi,
    interestRate,
    status,
    liabilityType,
    bucket,
  };

  state.totalOutstanding += outstandingAmount;
  state.totalMonthlyEmi += monthlyEmi;
  state.totalLiabilityCount += 1;
  state.includedRowCount += 1;
  state.includedRows.push({
    id: row.id,
    userId: row.user_id,
    label: normalizeText(row.account_name ?? row.name ?? row.liability_type ?? row.category) || row.id,
    liabilityType,
    bucket,
    status,
    outstandingAmount: roundMoney(outstandingAmount),
    monthlyEmi: roundMoney(monthlyEmi),
    interestRate: interestRate === null ? null : roundMoney(interestRate),
    originalAmount: row.original_amount === null || row.original_amount === undefined || row.original_amount === ""
      ? null
      : roundMoney(toNumber(row.original_amount)),
  });

  if (status.toLowerCase() === "active") {
    state.totalActiveLiabilityCount += 1;
  }

  if (interestRate !== null) {
    state.totalWeightedInterestNumerator += outstandingAmount * interestRate;
    state.totalWeightedInterestDenominator += outstandingAmount;
  }

  const typeTotals = state.byLiabilityType.get(liabilityType) ?? createAggregationTotals();
  updateAggregationTotals(typeTotals, coreMetrics);
  state.byLiabilityType.set(liabilityType, typeTotals);

  const bucketTotals = state.byPortfolioBucket.get(bucket) ?? createAggregationTotals();
  updateAggregationTotals(bucketTotals, coreMetrics);
  state.byPortfolioBucket.set(bucket, bucketTotals);

  const statusTotals = state.byStatus.get(status) ?? createAggregationTotals();
  updateAggregationTotals(statusTotals, coreMetrics);
  state.byStatus.set(status, statusTotals);

  const largestCandidate: LargestLiabilityItem = {
    id: row.id,
    userId: row.user_id,
    liabilityType,
    bucket,
    status,
    outstandingAmount: roundMoney(outstandingAmount),
    originalAmount: row.original_amount === null || row.original_amount === undefined || row.original_amount === ""
      ? null
      : roundMoney(toNumber(row.original_amount)),
    interestRate: interestRate === null ? null : roundMoney(interestRate),
    emi: roundMoney(monthlyEmi),
    shareOfTotalOutstanding: 0,
  };

  state.topLiabilities.push(largestCandidate);
  state.topLiabilities.sort((left, right) => right.outstandingAmount - left.outstandingAmount || left.id.localeCompare(right.id));
  if (state.topLiabilities.length > 3) {
    state.topLiabilities.length = 3;
  }

  if (!state.largestLiability || largestCandidate.outstandingAmount > state.largestLiability.outstandingAmount) {
    state.largestLiability = largestCandidate;
  }
}

function computeHerfindahlIndex(rows: readonly LiabilityDomainRow[]): number {
  const includedRows = rows
    .map((row) => ({ row, outstandingAmount: resolveOutstandingAmount(row) }))
    .filter(({ row, outstandingAmount }) => shouldIncludeRow(row).included && outstandingAmount > 0);

  const totalOutstanding = includedRows.reduce((sum, item) => sum + item.outstandingAmount, 0);
  if (totalOutstanding <= 0) {
    return 0;
  }

  return roundMoney(
    includedRows.reduce((sum, item) => {
      const share = item.outstandingAmount / totalOutstanding;
      return sum + share * share;
    }, 0),
  );
}

function buildSnapshotFromRows(rows: readonly LiabilityDomainRow[]): FinancialPositionInspection {
  const state = createState();

  for (const row of rows) {
    const inclusion = shouldIncludeRow(row);
    if (!inclusion.included) {
      appendExclusionReasons(state, row, inclusion.reasons);
      continue;
    }

    registerIncludedRow(state, row);
  }

  const totalOutstanding = roundMoney(state.totalOutstanding);
  const breakdownByLiabilityType = toAggregationItems(state.byLiabilityType, (key) => key, totalOutstanding);
  const breakdownByPortfolioBucket = toAggregationItems(state.byPortfolioBucket, bucketLabel, totalOutstanding);
  const breakdownByStatus = toAggregationItems(state.byStatus, (key) => key, totalOutstanding);
  const top3Share = totalOutstanding > 0
    ? roundMoney(state.topLiabilities.reduce((sum, liability) => sum + liability.outstandingAmount, 0) / totalOutstanding)
    : 0;
  const herfindahlIndex = computeHerfindahlIndex(rows);

  const snapshot: FinancialPositionSnapshot = {
    policyVersion: FINANCIAL_POSITION_POLICY_VERSION,
    asOf: new Date().toISOString(),
    databaseRowCount: rows.length,
    includedRowCount: state.includedRowCount,
    excludedRowCount: rows.length - state.includedRowCount,
    totalOutstanding,
    totalMonthlyEmi: roundMoney(state.totalMonthlyEmi),
    weightedAverageInterest: state.totalWeightedInterestDenominator > 0
      ? roundMoney(state.totalWeightedInterestNumerator / state.totalWeightedInterestDenominator)
      : null,
    liabilityCount: state.totalLiabilityCount,
    activeLiabilityCount: state.totalActiveLiabilityCount,
    breakdownByLiabilityType,
    breakdownByPortfolioBucket,
    breakdownByStatus,
    largestLiability: state.largestLiability
      ? {
          ...state.largestLiability,
          shareOfTotalOutstanding: totalOutstanding > 0 ? roundMoney(state.largestLiability.outstandingAmount / totalOutstanding) : 0,
        }
      : null,
    top3Share,
    herfindahlIndex,
  };

  const diagnostics: LiabilityDiagnostics = {
    databaseRowCount: rows.length,
    includedRowCount: state.includedRowCount,
    excludedRowCount: rows.length - state.includedRowCount,
    exclusionReasons: mapReasonSet(state.exclusionReasonMap),
    excludedRows: state.excludedRows,
  };

  return {
    snapshot,
    diagnostics,
    includedRows: state.includedRows,
  };
}

export function inspectFinancialPositionRows(rows: readonly LiabilityDomainRow[]): FinancialPositionInspection {
  return buildSnapshotFromRows(rows);
}

function compareMoney(left: number, right: number, tolerance = 0.01): boolean {
  return Math.abs(left - right) <= tolerance;
}

/**
 * Canonical financial-position service for liability metrics.
 *
 * This service is intentionally isolated from current UI consumers so the
 * Financial Position model can stabilize before screens migrate to it.
 */
export class LiabilityDomainService {
  constructor(private readonly repository: LiabilityDomainRepository = new SupabaseLiabilityDomainRepository()) {}

  /**
   * Returns a snapshot covering all canonical liability metrics.
   */
  async getFinancialPositionSnapshot(): Promise<FinancialPositionSnapshot> {
    const rows = await this.repository.listLiabilities();
    return inspectFinancialPositionRows(rows).snapshot;
  }

  /**
   * Returns breakdowns grouped for table and chart use.
   */
  async getFinancialPositionBreakdown(): Promise<FinancialPositionBreakdown> {
    const rows = await this.repository.listLiabilities();
    const { snapshot } = inspectFinancialPositionRows(rows);
    return {
      breakdownByLiabilityType: snapshot.breakdownByLiabilityType,
      breakdownByPortfolioBucket: snapshot.breakdownByPortfolioBucket,
      breakdownByStatus: snapshot.breakdownByStatus,
    };
  }

  /**
   * Returns the heaviest liabilities sorted by outstanding amount.
   */
  async getLargestLiabilities(limit = 3): Promise<LargestLiabilityItem[]> {
    const rows = await this.repository.listLiabilities();
    const included = rows.filter((row) => shouldIncludeRow(row).included);
    const totalOutstanding = included.reduce((sum, row) => sum + resolveOutstandingAmount(row), 0);

    return included
      .map((row) => {
        const outstandingAmount = roundMoney(resolveOutstandingAmount(row));
        return {
          id: row.id,
          userId: row.user_id,
          liabilityType: resolveLiabilityType(row),
          bucket: resolveBucket(resolveLiabilityType(row)),
          status: normalizeStatus(row.status),
          outstandingAmount,
          originalAmount: row.original_amount === null || row.original_amount === undefined || row.original_amount === ""
            ? null
            : roundMoney(toNumber(row.original_amount)),
          interestRate: resolveInterestRate(row),
          emi: roundMoney(resolveEmi(row)),
          shareOfTotalOutstanding: totalOutstanding > 0 ? roundMoney(outstandingAmount / totalOutstanding) : 0,
        } satisfies LargestLiabilityItem;
      })
      .sort((left, right) => right.outstandingAmount - left.outstandingAmount || left.id.localeCompare(right.id))
      .slice(0, Math.max(0, Math.trunc(limit)));
  }

  /**
   * Returns row-level diagnostics for inclusion and exclusion counts.
   */
  async getDiagnostics(): Promise<LiabilityDiagnostics> {
    const rows = await this.repository.listLiabilities();
    return inspectFinancialPositionRows(rows).diagnostics;
  }

  /**
   * Verifies snapshot invariants required by FinancialPositionPolicy v1.0.
   */
  validateSnapshot(snapshot: FinancialPositionSnapshot): FinancialPositionValidationResult {
    const checks: FinancialPositionValidationCheck[] = [];

    const liabilitiesByType = snapshot.breakdownByLiabilityType.reduce((sum, item) => sum + item.outstandingAmount, 0);
    const liabilitiesByBucket = snapshot.breakdownByPortfolioBucket.reduce((sum, item) => sum + item.outstandingAmount, 0);
    const largestOutstanding = snapshot.largestLiability?.outstandingAmount ?? 0;

    checks.push({
      name: "total_outstanding_matches_liability_type_breakdown",
      passed: compareMoney(snapshot.totalOutstanding, liabilitiesByType),
      expected: snapshot.totalOutstanding,
      actual: roundMoney(liabilitiesByType),
      message: "Total Outstanding must equal the sum of breakdown by liability type.",
    });

    checks.push({
      name: "total_outstanding_matches_portfolio_bucket_breakdown",
      passed: compareMoney(snapshot.totalOutstanding, liabilitiesByBucket),
      expected: snapshot.totalOutstanding,
      actual: roundMoney(liabilitiesByBucket),
      message: "Total Outstanding must equal the sum of breakdown by portfolio bucket.",
    });

    checks.push({
      name: "largest_liability_is_not_greater_than_total_outstanding",
      passed: largestOutstanding <= snapshot.totalOutstanding + 0.01,
      expected: snapshot.totalOutstanding,
      actual: largestOutstanding,
      message: "Largest liability cannot exceed Total Outstanding.",
    });

    checks.push({
      name: "included_plus_excluded_matches_database_rows",
      passed: snapshot.includedRowCount + snapshot.excludedRowCount === snapshot.databaseRowCount,
      expected: snapshot.databaseRowCount,
      actual: snapshot.includedRowCount + snapshot.excludedRowCount,
      message: "Included row count plus excluded row count must equal database row count.",
    });

    return {
      valid: checks.every((check) => check.passed),
      snapshot,
      checks,
    };
  }
}

/**
 * Default repository adapter that reads liabilities from the existing data layer.
 */
export class SupabaseLiabilityDomainRepository implements LiabilityDomainRepository {
  async listLiabilities(): Promise<readonly LiabilityDomainRow[]> {
    return (await getLiabilities()) as unknown as readonly LiabilityDomainRow[];
  }
}

export const liabilityDomainService = new LiabilityDomainService();

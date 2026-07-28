import type { FinancialPositionInspection, FinancialPositionInspectionRow, FinancialPositionValidationResult, LiabilityDiagnosticsReasonBreakdown } from "./LiabilityDomainService";

export interface FinancialPositionLegacyRow {
  id: string;
  label: string;
  liabilityType: string;
  outstandingAmount: number;
  monthlyEmi: number;
}

export interface FinancialPositionValidationContext {
  screen: string;
  legacyRows: readonly FinancialPositionLegacyRow[];
  canonical: FinancialPositionInspection;
  validation: FinancialPositionValidationResult;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function formatReasonLabel(reason: LiabilityDiagnosticsReasonBreakdown["reason"]): string {
  switch (reason) {
    case "zero_or_negative_outstanding":
      return "Zero Outstanding";
    case "archived":
      return "Archived";
    case "deleted":
      return "Deleted";
  }
}

function aggregateRows(rows: readonly FinancialPositionLegacyRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.totalOutstanding += Number(row.outstandingAmount ?? 0);
      acc.totalMonthlyEmi += Number(row.monthlyEmi ?? 0);
      acc.rowCount += 1;
      acc.rows.push(row);
      return acc;
    },
    {
      totalOutstanding: 0,
      totalMonthlyEmi: 0,
      rowCount: 0,
      rows: [] as FinancialPositionLegacyRow[],
    },
  );
}

function toDeltaRows(
  sourceRows: readonly FinancialPositionLegacyRow[],
  targetRows: readonly FinancialPositionInspectionRow[],
  sourceLabel: string,
  targetLabel: string,
) {
  const targetIds = new Set(targetRows.map((row) => row.id));

  return sourceRows
    .filter((row) => !targetIds.has(row.id))
    .map((row) => ({
      direction: `${sourceLabel} only -> not in ${targetLabel}`,
      id: row.id,
      label: row.label,
      liabilityType: row.liabilityType,
      outstandingAmount: roundMoney(row.outstandingAmount),
      monthlyEmi: roundMoney(row.monthlyEmi),
    }));
}

function toCanonicalOnlyRows(
  sourceRows: readonly FinancialPositionLegacyRow[],
  targetRows: readonly FinancialPositionInspectionRow[],
  sourceLabel: string,
  targetLabel: string,
) {
  const sourceIds = new Set(sourceRows.map((row) => row.id));

  return targetRows
    .filter((row) => !sourceIds.has(row.id))
    .map((row) => ({
      direction: `${targetLabel} only -> not in ${sourceLabel}`,
      id: row.id,
      label: row.label,
      liabilityType: row.liabilityType,
      outstandingAmount: roundMoney(row.outstandingAmount),
      monthlyEmi: roundMoney(row.monthlyEmi),
    }));
}

/**
 * Emits a structured comparison of the legacy screen calculation and the
 * canonical Financial Position snapshot.
 *
 * This is intentionally dev-only and has no effect on UI state.
 */
export function logFinancialPositionValidation(context: FinancialPositionValidationContext): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const legacyTotals = aggregateRows(context.legacyRows);
  const canonicalTotals = context.canonical.snapshot;
  const differenceOutstanding = roundMoney(canonicalTotals.totalOutstanding - legacyTotals.totalOutstanding);
  const differenceEmi = roundMoney(canonicalTotals.totalMonthlyEmi - legacyTotals.totalMonthlyEmi);

  const legacyRows = context.legacyRows;
  const canonicalRows = context.canonical.includedRows;
  const deltaRows = [
    ...toDeltaRows(legacyRows, canonicalRows, "legacy", "canonical"),
    ...toCanonicalOnlyRows(legacyRows, canonicalRows, "legacy", "canonical"),
  ];

  const invariantFailures = context.validation.checks
    .filter((check) => !check.passed)
    .map((check) => ({
      name: check.name,
      message: check.message,
      expected: check.expected,
      actual: check.actual,
    }));

  const payload = {
    screen: context.screen,
    legacy: {
      totalOutstanding: roundMoney(legacyTotals.totalOutstanding),
      totalMonthlyEmi: roundMoney(legacyTotals.totalMonthlyEmi),
      rowCount: legacyTotals.rowCount,
    },
    canonical: {
      totalOutstanding: canonicalTotals.totalOutstanding,
      totalMonthlyEmi: canonicalTotals.totalMonthlyEmi,
      rowCount: canonicalTotals.includedRowCount,
      policyVersion: canonicalTotals.policyVersion,
    },
    difference: {
      totalOutstanding: differenceOutstanding,
      totalMonthlyEmi: differenceEmi,
    },
    diagnostics: {
      databaseRowCount: context.canonical.diagnostics.databaseRowCount,
      includedRowCount: context.canonical.diagnostics.includedRowCount,
      excludedRowCount: context.canonical.diagnostics.excludedRowCount,
      exclusionReasons: context.canonical.diagnostics.exclusionReasons.map((item) => ({
        reason: formatReasonLabel(item.reason),
        count: item.count,
        liabilityIds: item.liabilityIds,
      })),
    },
    validation: {
      result: context.validation.valid,
      invariantFailures,
    },
    rowsCausingDelta: deltaRows,
  };

  console.info("--------------------------------------------------");
  console.info("Financial Position Validation");
  console.info(payload);
}

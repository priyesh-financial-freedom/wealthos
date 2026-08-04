// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { RollingProjectionWorkflow } from "./RollingProjectionWorkflow";
import type { RollingProjectionPreviewResult } from "@/services/projection/RollingProjectionService";
import type { ProjectionViewerRollingPlanResult } from "@/services/projection/ProjectionReadService";

const refreshSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildPreview(): RollingProjectionPreviewResult {
  return {
    input: {
      householdId: null,
      versionNo: 2,
      assumptions: {
        salary: {
          currentGrossSalary: 120000,
          currentBasicSalary: 50000,
          annualIncrementPercent: 8,
          incrementMonth: 4,
          retirementMonth: "2035-01",
        },
        contributions: {
          mutualFundsMonthlySip: 20000,
          epfEmployeeContributionRate: 12,
          epfEmployerContributionRate: 12,
          npsContributionRate: 10,
          ppfMonthlyContributionPriyesh: 8000,
          ppfAnnualContributionShobhana: 120000,
        },
        returns: {
          cashAnnualReturnPercent: 4,
          mutualFundsAnnualReturnPercent: 12,
          stocksAnnualReturnPercent: 14,
          epfAnnualReturnPercent: 8,
          ppfAnnualReturnPercent: 7.1,
          npsAnnualReturnPercent: 10,
          nonFinancialAnnualReturnPercent: 6,
        },
        expenses: {
          preRetirementMonthlyExpense: 60000,
          annualExpenseInflationPercent: 6,
          postRetirementExpenseReductionPercent: 20,
          monthlyEmi: 20000,
          monthlyInsurancePremium: 3000,
        },
        npsSplitPolicy: {
          lumpsumPercent: 50,
          annuityPercent: 50,
        },
        netSalaryIncludesEmployeeDeductions: true,
        liabilitiesMonthlyRepayment: 10000,
      },
      priorRollingVersionId: null,
    },
    linkedFixedPlanId: "fixed-1",
    linkedFixedVersionNo: 1,
    rebasedFromMonth: "2026-07",
    rebasedFromCloseId: "close-2026-07",
    startMonth: "2026-08",
    horizonEndMonth: "2026-10",
    openingBalances: {
      cash: 180000,
      mutualFunds: 580000,
      stocks: 250000,
      epf: 340000,
      ppf: 120000,
      nps: 200000,
      property: 5200000,
      gold: 320000,
      otherNonFinancialAssets: 150000,
      liabilities: 700000,
    },
    assumptions: {
      salary: {
        currentGrossSalary: 120000,
        currentBasicSalary: 50000,
        annualIncrementPercent: 8,
        incrementMonth: 4,
        retirementMonth: "2035-01",
      },
      contributions: {
        mutualFundsMonthlySip: 20000,
        epfEmployeeContributionRate: 12,
        epfEmployerContributionRate: 12,
        npsContributionRate: 10,
        ppfMonthlyContributionPriyesh: 8000,
        ppfAnnualContributionShobhana: 120000,
      },
      returns: {
        cashAnnualReturnPercent: 4,
        mutualFundsAnnualReturnPercent: 12,
        stocksAnnualReturnPercent: 14,
        epfAnnualReturnPercent: 8,
        ppfAnnualReturnPercent: 7.1,
        npsAnnualReturnPercent: 10,
        nonFinancialAnnualReturnPercent: 6,
      },
      expenses: {
        preRetirementMonthlyExpense: 60000,
        annualExpenseInflationPercent: 6,
        postRetirementExpenseReductionPercent: 20,
        monthlyEmi: 20000,
        monthlyInsurancePremium: 3000,
      },
      npsSplitPolicy: {
        lumpsumPercent: 50,
        annuityPercent: 50,
      },
      netSalaryIncludesEmployeeDeductions: true,
      liabilitiesMonthlyRepayment: 10000,
    },
    oneTimeOutflows: [
      {
        id: "goal-1",
        name: "MBA tuition",
        month: "2026-09",
        amount: 400000,
        source: "Goal",
      },
    ],
    validation: {
      canFreeze: true,
      blockers: [],
      warnings: [],
    },
    canFreeze: true,
    assumptionSnapshotInput: {
      assumption_payload: {},
      salary_policy_payload: {},
      retirement_policy_payload: {},
      drawdown_policy_payload: {},
    },
    salaryCurveRows: [],
    monthlyPositionRows: [],
    monthRows: [
      {
        month: "2026-08",
        cash: 190000,
        mutual_funds: 590000,
        stocks: 260000,
        epf: 350000,
        ppf: 121000,
        nps: 205000,
        financial_assets_total: 1716000,
        non_financial_assets_total: 5670000,
        liabilities: 695000,
        net_worth: 6691000,
      },
    ],
    monthSnapshots: [
      {
        month: "2026-08",
        net_worth: 6691000,
        financial_assets_total: 1716000,
        retirement_corpus: 1266000,
        property_value: 5200000,
        total_debt: 695000,
        monthly_income: 90000,
        monthly_expense: 60000,
        corpus_drawdown: 0,
      },
    ],
  };
}

function buildLockedProjection(): ProjectionViewerRollingPlanResult {
  return {
    plan: {
      id: "rolling-1",
      version_no: 3,
      status: "LOCKED",
      start_month: "2026-08",
      horizon_end_month: "2026-10",
      locked_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
      parent_fixed_version_id: "fixed-1",
      base_close_id: "close-2026-07",
    },
    monthRows: [
      {
        month: "2026-08",
        cash: 190000,
        mutual_funds: 590000,
        stocks: 260000,
        epf: 350000,
        ppf: 121000,
        nps: 205000,
        financial_assets_total: 1716000,
        non_financial_assets_total: 5670000,
        liabilities: 695000,
        net_worth: 6691000,
      },
    ],
    monthSnapshots: [
      {
        month: "2026-08",
        net_worth: 6691000,
        financial_assets_total: 1716000,
        retirement_corpus: 1266000,
        property_value: 5200000,
        total_debt: 695000,
        monthly_income: 90000,
        monthly_expense: 60000,
        corpus_drawdown: 0,
      },
    ],
    linkedFixedVersionNo: 1,
    rebasedFromMonth: "2026-07",
  };
}

describe("RollingProjectionWorkflow", () => {
  it("shows empty state and generate preview action", () => {
    render(
      <RollingProjectionWorkflow
        lockedProjection={null}
        primaryCurrentAge={null}
        retirementAge={null}
      />,
    );

    expect(screen.getByText("No Rolling Projection is available yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate Rolling Preview" })).toBeTruthy();
  });

  it("requires explicit confirmation before freeze", async () => {
    const createPreviewMock = vi.fn(async () => buildPreview());
    const freezePreviewMock = vi.fn(async () => null);
    const confirmFreezeMock = vi.fn(() => false);

    render(
      <RollingProjectionWorkflow
        lockedProjection={null}
        primaryCurrentAge={null}
        retirementAge={null}
        deps={{
          createPreview: createPreviewMock,
          freezePreview: freezePreviewMock,
          hasLockedProjection: async () => false,
          confirmFreeze: confirmFreezeMock,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate Rolling Preview" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Freeze Rolling Projection" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Freeze Rolling Projection" }));

    await waitFor(() => {
      expect(confirmFreezeMock).toHaveBeenCalledTimes(1);
    });
    expect(freezePreviewMock).not.toHaveBeenCalled();

    confirmFreezeMock.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Freeze Rolling Projection" }));

    await waitFor(() => {
      expect(freezePreviewMock).toHaveBeenCalledTimes(1);
    });
  });

  it("blocks freeze when a locked rolling projection already exists", async () => {
    const createPreviewMock = vi.fn(async () => buildPreview());
    const freezePreviewMock = vi.fn(async () => null);

    render(
      <RollingProjectionWorkflow
        lockedProjection={null}
        primaryCurrentAge={null}
        retirementAge={null}
        deps={{
          createPreview: createPreviewMock,
          freezePreview: freezePreviewMock,
          hasLockedProjection: async () => true,
          confirmFreeze: () => true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate Rolling Preview" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Freeze Rolling Projection" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Freeze Rolling Projection" }));

    await waitFor(() => {
      expect(screen.getByText("A locked Rolling Projection already exists. Existing locked versions are read-only.")).toBeTruthy();
    });
    expect(freezePreviewMock).not.toHaveBeenCalled();
  });

  it("renders locked projection in read-only mode", () => {
    render(
      <RollingProjectionWorkflow
        lockedProjection={buildLockedProjection()}
        primaryCurrentAge={null}
        retirementAge={null}
      />,
    );

    expect(screen.getByText("LOCKED")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate Rolling Preview" })).toBeNull();
  });
});

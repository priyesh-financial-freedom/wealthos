// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FixedProjectionWorkflow } from "./FixedProjectionWorkflow";
import type { CreateFixedProjectionV1Input, FixedProjectionInputBuildResult, FixedProjectionPreviewResult } from "@/services/projection";

const refreshSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildInput(): CreateFixedProjectionV1Input {
  return {
    householdId: null,
    versionNo: 1,
    startMonth: "2026-08",
    horizonEndMonth: "2035-12",
    openingBalances: {
      cash: 100000,
      mutualFunds: 500000,
      stocks: 200000,
      epf: 300000,
      ppf: 100000,
      nps: 150000,
      property: 5000000,
      gold: 300000,
      otherNonFinancialAssets: 100000,
      liabilities: 1000000,
    },
    assumptions: {
      salary: {
        currentGrossSalary: 100000,
        currentBasicSalary: 40000,
        annualIncrementPercent: 10,
        incrementMonth: 7,
        retirementMonth: "2034-08",
      },
      contributions: {
        mutualFundsMonthlySip: 20000,
        epfEmployeeContributionRate: 12,
        epfEmployerContributionRate: 12,
        npsContributionRate: 10,
        ppfMonthlyContributionPriyesh: 10000,
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
        preRetirementMonthlyExpense: 40000,
        annualExpenseInflationPercent: 6,
        postRetirementExpenseReductionPercent: 20,
        monthlyEmi: 15000,
        monthlyInsurancePremium: 5000,
      },
      npsSplitPolicy: {
        lumpsumPercent: 50,
        annuityPercent: 50,
      },
      liabilitiesMonthlyRepayment: 10000,
    },
  };
}

function buildValidation(overrides?: Partial<FixedProjectionInputBuildResult["validation"]>): FixedProjectionInputBuildResult {
  return {
    input: buildInput(),
    validation: {
      canPreview: true,
      canFreeze: true,
      blockers: [],
      warnings: [],
      defaultsUsed: [],
      ...overrides,
    },
    sourceReport: [
      { fieldName: "startMonth", source: "test", status: "real" },
      { fieldName: "stocksAnnualReturnPercent", source: "test", status: "real" },
    ],
  };
}

function buildPreview(input: CreateFixedProjectionV1Input): FixedProjectionPreviewResult {
  return {
    input,
    startMonth: "2026-08",
    horizonEndMonth: "2035-12",
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
        cash: 120000,
        mutual_funds: 510000,
        stocks: 210000,
        epf: 305000,
        ppf: 102000,
        nps: 152000,
        financial_assets_total: 1399000,
        non_financial_assets_total: 5400000,
        liabilities: 990000,
        net_worth: 5809000,
      },
    ],
    monthSnapshots: [
      {
        month: "2026-08",
        net_worth: 680000,
        financial_assets_total: 500000,
        retirement_corpus: 400000,
        property_value: 300000,
        total_debt: 120000,
        monthly_income: 50000,
        monthly_expense: 30000,
        corpus_drawdown: 0,
      },
      {
        month: "2026-09",
        net_worth: 700000,
        financial_assets_total: 520000,
        retirement_corpus: 410000,
        property_value: 305000,
        total_debt: 118000,
        monthly_income: 50000,
        monthly_expense: 32000,
        corpus_drawdown: 0,
      },
      {
        month: "2034-08",
        net_worth: 1500000,
        financial_assets_total: 1200000,
        retirement_corpus: 900000,
        property_value: 650000,
        total_debt: 60000,
        monthly_income: 0,
        monthly_expense: 45000,
        corpus_drawdown: 45000,
      },
    ],
  };
}

describe("Planning Fixed Projection Page", () => {
  it("shows empty state with Generate Preview and no legacy Generate Fixed Projection", () => {
    render(
      <FixedProjectionWorkflow
        lockedProjection={null}
        primaryCurrentAge={60}
        retirementAge={68}
        debtAnnualReturnPercent={7}
      />,
    );

    expect(screen.getByText("No Fixed Projection has been generated yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate Preview" })).toBeTruthy();
    expect(screen.queryByText("Generate Fixed Projection")).toBeNull();
  });

  it("generates preview using builder, does not write during preview, and shows assumptions including separate stocks return", async () => {
    const input = buildInput();
    const buildInputMock = vi.fn(async () => buildValidation());
    const createPreviewMock = vi.fn(() => buildPreview(input));
    const freezePreviewMock = vi.fn(async () => null);

    render(
      <FixedProjectionWorkflow
        lockedProjection={null}
        primaryCurrentAge={60}
        retirementAge={68}
        debtAnnualReturnPercent={7}
        deps={{
          buildInput: buildInputMock,
          createPreview: createPreviewMock,
          freezePreview: freezePreviewMock,
          hasLockedProjection: async () => false,
          confirmFreeze: () => true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate Preview" }));

    await waitFor(() => {
      expect(buildInputMock).toHaveBeenCalledTimes(1);
      expect(createPreviewMock).toHaveBeenCalledTimes(1);
    });

    expect(freezePreviewMock).not.toHaveBeenCalled();
    expect(screen.getByText("Preview Only - Not Frozen")).toBeTruthy();
    expect(screen.getByText("Mutual Fund Return %")).toBeTruthy();
    expect(screen.getByText("Stocks Return %")).toBeTruthy();
    expect(screen.getByText("12%")).toBeTruthy();
    expect(screen.getByText("14%")).toBeTruthy();
  });

  it("hides freeze when blockers prevent preview and supports discard back to empty state", async () => {
    const buildInputMock = vi.fn(async () => ({
      ...buildValidation({ canPreview: false, canFreeze: false, blockers: ["Stocks Return % is missing."] }),
      input: null,
    }));

    render(
      <FixedProjectionWorkflow
        lockedProjection={null}
        primaryCurrentAge={60}
        retirementAge={68}
        debtAnnualReturnPercent={7}
        deps={{
          buildInput: buildInputMock,
          createPreview: vi.fn(() => buildPreview(buildInput())),
          freezePreview: vi.fn(async () => null),
          hasLockedProjection: async () => false,
          confirmFreeze: () => true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate Preview" }));

    await waitFor(() => {
      expect(screen.getByText("Blockers")).toBeTruthy();
      expect(screen.getByText(/Stocks Return/)).toBeTruthy();
    });

    expect(screen.queryByRole("button", { name: "Freeze Fixed Projection" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Discard Preview" }));
    expect(screen.getByRole("button", { name: "Generate Preview" })).toBeTruthy();
  });

  it("requires explicit freeze confirmation and only freezes after confirm", async () => {
    const input = buildInput();
    const freezePreviewMock = vi.fn(async () => null);
    const confirmFreezeMock = vi.fn(() => false);

    render(
      <FixedProjectionWorkflow
        lockedProjection={null}
        primaryCurrentAge={60}
        retirementAge={68}
        debtAnnualReturnPercent={7}
        deps={{
          buildInput: async () => buildValidation(),
          createPreview: () => buildPreview(input),
          freezePreview: freezePreviewMock,
          hasLockedProjection: async () => false,
          confirmFreeze: confirmFreezeMock,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate Preview" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Freeze Fixed Projection" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Freeze Fixed Projection" }));
    await waitFor(() => {
      expect(confirmFreezeMock).toHaveBeenCalledTimes(1);
    });
    expect(freezePreviewMock).not.toHaveBeenCalled();

    confirmFreezeMock.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Freeze Fixed Projection" }));
    await waitFor(() => {
      expect(freezePreviewMock).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps existing locked fixed projection in read-only mode and supports preview selector jumps", async () => {
    render(
      <FixedProjectionWorkflow
        lockedProjection={{
          plan: {
            id: "plan-1",
            version_no: 1,
            status: "LOCKED",
            start_month: "2026-08",
            horizon_end_month: "2035-12",
            locked_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
            parent_fixed_version_id: null,
            base_close_id: null,
          },
          monthRows: [
            {
              month: "2026-08",
              cash: 120000,
              mutual_funds: 510000,
              stocks: 210000,
              epf: 305000,
              ppf: 102000,
              nps: 152000,
              financial_assets_total: 1399000,
              non_financial_assets_total: 5400000,
              liabilities: 990000,
              net_worth: 5809000,
            },
          ],
          monthSnapshots: buildPreview(buildInput()).monthSnapshots,
        }}
        primaryCurrentAge={60}
        retirementAge={68}
        debtAnnualReturnPercent={7}
      />,
    );

    expect(screen.getByText("LOCKED")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate Preview" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retirement" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retirement" }));
    expect(screen.getByRole("heading", { name: "Aug 2034" })).toBeTruthy();
  });
});

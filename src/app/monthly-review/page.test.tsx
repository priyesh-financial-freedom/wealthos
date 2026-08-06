// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MonthEndCloseWorkspace } from "@/types/monthEndClose";
import type { RetirementAccount } from "@/types/retirementAccount";

let MonthlyReviewPage: typeof import("./page").default;

const monthEndCloseMocks = vi.hoisted(() => ({
  getMonthEndCloseWorkspaceMock: vi.fn<() => Promise<MonthEndCloseWorkspace>>(),
  saveMonthEndCloseDraftMock: vi.fn(),
  closeMonthEndCloseMock: vi.fn(),
  reopenMonthMock: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  getRetirementAccountsMock: vi.fn<() => Promise<RetirementAccount[]>>(),
  updateRetirementAccountMock: vi.fn(),
  getGoldHoldingsMock: vi.fn<() => Promise<Array<Record<string, unknown>>>>(),
  createGoldHoldingMock: vi.fn(),
  updateGoldHoldingMock: vi.fn(),
  getSilverHoldingsMock: vi.fn<() => Promise<Array<Record<string, unknown>>>>(),
  createSilverHoldingMock: vi.fn(),
  updateSilverHoldingMock: vi.fn(),
  getRealEstatePropertiesMock: vi.fn<() => Promise<Array<Record<string, unknown>>>>(),
  updateRealEstatePropertyMock: vi.fn(),
  getBankAccountsMock: vi.fn<() => Promise<Array<Record<string, unknown>>>>(),
  updateBankAccountMock: vi.fn(),
  getInvestmentsMock: vi.fn<() => Promise<Array<Record<string, unknown>>>>(),
  updateInvestmentMock: vi.fn(),
  calculateVarianceSummaryMock: vi.fn(),
}));

const {
  getMonthEndCloseWorkspaceMock,
  saveMonthEndCloseDraftMock,
  closeMonthEndCloseMock,
  reopenMonthMock,
} = monthEndCloseMocks;

const {
  getRetirementAccountsMock,
  updateRetirementAccountMock,
  getGoldHoldingsMock,
  createGoldHoldingMock,
  updateGoldHoldingMock,
  getSilverHoldingsMock,
  createSilverHoldingMock,
  updateSilverHoldingMock,
  getRealEstatePropertiesMock,
  updateRealEstatePropertyMock,
  getBankAccountsMock,
  updateBankAccountMock,
  getInvestmentsMock,
  updateInvestmentMock,
  calculateVarianceSummaryMock,
} = serviceMocks;

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  getRetirementAccountsMock.mockResolvedValue([]);
  getGoldHoldingsMock.mockResolvedValue([]);
  getSilverHoldingsMock.mockResolvedValue([]);
  getRealEstatePropertiesMock.mockResolvedValue([]);
  getBankAccountsMock.mockResolvedValue([]);
  getInvestmentsMock.mockResolvedValue([]);
  updateRetirementAccountMock.mockResolvedValue({});
  createGoldHoldingMock.mockResolvedValue({
    id: "gold-created",
    current_value: 0,
  });
  updateGoldHoldingMock.mockResolvedValue({});
  createSilverHoldingMock.mockResolvedValue({
    id: "silver-created",
    current_value: 0,
  });
  updateSilverHoldingMock.mockResolvedValue({});
  updateRealEstatePropertyMock.mockResolvedValue({});
  updateBankAccountMock.mockResolvedValue({});
  updateInvestmentMock.mockResolvedValue({});
  saveMonthEndCloseDraftMock.mockResolvedValue({});
  closeMonthEndCloseMock.mockResolvedValue({});
  calculateVarianceSummaryMock.mockReturnValue({
    actualKpis: {
      cash: 0,
      mutualFunds: 0,
      totalAssets: 1000,
      totalLiabilities: 200,
      netWorth: 800,
      totalsByKey: {
        bank_accounts: 0,
        mutual_funds: 0,
        stocks: 0,
        gold: 0,
        silver: 0,
        fixed_deposits: 0,
        epf: 0,
        ppf: 0,
        nps: 0,
        real_estate: 0,
        other_assets: 0,
        home_loans: 0,
        car_loans: 0,
        other_liabilities: 0,
      },
    },
    projectedKpis: {
      cash: 0,
      mutualFunds: 0,
      totalAssets: 900,
      totalLiabilities: 200,
      netWorth: 700,
      totalsByKey: {
        bank_accounts: 0,
        mutual_funds: 0,
        stocks: 0,
        gold: 0,
        silver: 0,
        fixed_deposits: 0,
        epf: 0,
        ppf: 0,
        nps: 0,
        real_estate: 0,
        other_assets: 0,
        home_loans: 0,
        car_loans: 0,
        other_liabilities: 0,
      },
    },
    projectionVariance: 100,
  });
});

beforeAll(async () => {
  MonthlyReviewPage = (await import("./page")).default;
});

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/dashboard/DashboardCard", () => ({
  DashboardCard: ({ children, className }: { children: unknown; className?: string }) => <section className={className}>{children}</section>,
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, type = "button" }: { children: unknown; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" | "reset" }) => (
    <button type={type} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: unknown }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: unknown }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: unknown }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: unknown }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/feedback", () => ({
  LoadingSpinner: ({ label }: { label?: string }) => <div>{label}</div>,
  ToastViewport: ({ message }: { message?: string }) => (message ? <div>{message}</div> : null),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock("@/services/assumptions", () => ({
  DEFAULT_SCENARIO_KEY: "default",
}));

vi.mock("@/services/assets", () => ({
  getAssets: async () => [],
  updateAsset: async () => ({}),
}));

vi.mock("@/services/cashFlowManagement", () => ({
  cashFlowManagementService: {
    getCashFlowSnapshot: async () => null,
    upsertLivingExpense: async () => ({}),
  },
}));

vi.mock("@/services/compensation", () => ({
  compensationService: {
    getSummary: async () => null,
  },
}));

vi.mock("@/services/investments", () => ({
  getInvestments: getInvestmentsMock,
  updateInvestment: updateInvestmentMock,
}));

vi.mock("@/services/bankAccounts", () => ({
  getBankAccounts: getBankAccountsMock,
  updateBankAccount: updateBankAccountMock,
}));

vi.mock("@/services/liabilities", () => ({
  getLiabilities: async () => [],
  updateLiability: async () => ({}),
}));

vi.mock("@/services/monthEndClose", () => ({
  getMonthEndCloseWorkspace: getMonthEndCloseWorkspaceMock,
  saveMonthEndCloseDraft: saveMonthEndCloseDraftMock,
  closeMonthEndClose: closeMonthEndCloseMock,
  reopenMonth: reopenMonthMock,
}));

vi.mock("@/services/monthEndClose/MonthEndCloseService", () => ({
  calculateMonthEndCloseVarianceSummary: calculateVarianceSummaryMock,
}));

vi.mock("@/services/projection", () => ({
  projectionInputService: {
    buildContext: async () => null,
  },
  monthlyReviewComparisonService: {
    getMonthlyReviewComparison: async () => ({
      user_id: "user-1",
      review_month: "2026-08",
      actual_close_id: null,
      fixed_plan_version_id: null,
      rolling_plan_version_id: null,
      rows: [],
    }),
  },
}));

vi.mock("@/services/retirement", () => ({
  getRetirementAccounts: getRetirementAccountsMock,
  updateRetirementAccount: updateRetirementAccountMock,
}));

vi.mock("@/services/goldHoldings", () => ({
  getGoldHoldings: getGoldHoldingsMock,
  createGoldHolding: createGoldHoldingMock,
  updateGoldHolding: updateGoldHoldingMock,
}));

vi.mock("@/services/silverHoldings", () => ({
  getSilverHoldings: getSilverHoldingsMock,
  createSilverHolding: createSilverHoldingMock,
  updateSilverHolding: updateSilverHoldingMock,
}));

vi.mock("@/services/realEstateProperties", () => ({
  getRealEstateProperties: getRealEstatePropertiesMock,
  updateRealEstateProperty: updateRealEstatePropertyMock,
}));

vi.mock("@/services/monthlySnapshots", () => ({
  closeCurrentMonthSnapshot: async () => ({}),
}));

function buildWorkspace(overrides?: Partial<MonthEndCloseWorkspace>): MonthEndCloseWorkspace {
  return {
    close: {
      id: "open-aug-close",
      user_id: "user-1",
      close_month: 8,
      close_year: 2026,
      version_number: 1,
      status: "draft",
      supersedes_close_id: "c826b7f9-e0ab-4b31-96e3-6275a09e767c",
      closed_at: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
    latestClose: {
      id: "c826b7f9-e0ab-4b31-96e3-6275a09e767c",
      user_id: "user-1",
      close_month: 7,
      close_year: 2026,
      version_number: 2,
      status: "closed",
      supersedes_close_id: null,
      closed_at: "2026-07-31T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-31T00:00:00.000Z",
    },
    month: { month: 8, year: 2026, monthKey: "2026-08", label: "August 2026" },
    status: "draft",
    items: [],
    dashboard: {
      currentClosedMonth: { month: 7, year: 2026, monthKey: "2026-07", label: "July 2026" },
      pendingMonth: { month: 8, year: 2026, monthKey: "2026-08", label: "August 2026" },
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      monthOverMonthChange: 0,
      projectionVariance: 0,
      largestPositiveVariance: null,
      largestNegativeVariance: null,
    },
    ...overrides,
  };
}

function buildWorkspaceItem(partial: {
  rowKey: string;
  entityId: string;
  entityType: "retirement-account" | "gold-holding" | "silver-holding" | "real-estate-property" | "asset";
  entityTypeLabel: string;
  entityName: string;
  key: "epf" | "ppf" | "nps" | "gold" | "silver" | "real_estate" | "other_assets";
  actualValue: number;
  projectedValue?: number;
}): MonthEndCloseWorkspace["items"][number] {
  const projectedValue = partial.projectedValue ?? 0;
  return {
    rowKey: partial.rowKey,
    entityId: partial.entityId,
    entityType: partial.entityType,
    entityTypeLabel: partial.entityTypeLabel,
    entityName: partial.entityName,
    key: partial.key,
    label: partial.entityName,
    itemType: "asset",
    sortOrder: 1,
    openingValue: partial.actualValue,
    projectedValue,
    actualValue: partial.actualValue,
    absoluteVariance: partial.actualValue - projectedValue,
    percentageVariance: projectedValue === 0 ? 0 : ((partial.actualValue - projectedValue) / Math.abs(projectedValue)) * 100,
  };
}

describe("MonthlyReviewPage", () => {
  it("renders projection comparison section", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace());

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("Projection Comparison")).toBeTruthy();
    expect(await screen.findByText(/Data required/)).toBeTruthy();
  });

  it("shows latest closed month reopen section in pending workspace", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace());

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("Latest closed month: July 2026")).toBeTruthy();
    expect(screen.getAllByText("Reopen July 2026").length).toBeGreaterThan(0);
  });

  it("hides latest closed reopen section when latestClose is missing", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace({ latestClose: null }));

    render(<MonthlyReviewPage />);

    await screen.findByText("Projection Comparison");
    expect(screen.queryByText("Latest closed month: July 2026")).toBeNull();
    expect(screen.queryByText("Reopen July 2026")).toBeNull();
  });

  it("reopens using latestClose.id, requires reason, and reloads workspace", async () => {
    getMonthEndCloseWorkspaceMock
      .mockResolvedValueOnce(buildWorkspace())
      .mockResolvedValueOnce(buildWorkspace({
        latestClose: {
          ...buildWorkspace().latestClose!,
          id: "reopened-as-draft",
          status: "draft",
          closed_at: null,
        },
      }));
    reopenMonthMock.mockResolvedValueOnce({});

    render(<MonthlyReviewPage />);

    fireEvent.click((await screen.findAllByText("Reopen July 2026"))[0]);
    fireEvent.click(screen.getByText("Reopen"));

    expect((await screen.findAllByText("A reason is required to reopen the month.")).length).toBeGreaterThan(0);
    expect(reopenMonthMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Enter reason"), {
      target: { value: "Need corrections in July valuation" },
    });
    fireEvent.click(screen.getByText("Reopen"));

    await waitFor(() => {
      expect(reopenMonthMock).toHaveBeenCalledWith({
        closeId: "c826b7f9-e0ab-4b31-96e3-6275a09e767c",
        reason: "Need corrections in July valuation",
      });
    });

    await waitFor(() => {
      expect(getMonthEndCloseWorkspaceMock).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText("July 2026 has been reopened for corrections.")).toBeTruthy();
  });

  it("renders redesigned balance sheet sections with retirement and precious metals inputs", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace());
    getRetirementAccountsMock.mockResolvedValueOnce([
      {
        id: "epf-1",
        user_id: "user-1",
        account_type: "EPF",
        owner: "Self",
        institution: "EPFO",
        current_balance: 100000,
        account_number: null,
        opening_date: null,
        interest_rate: null,
        nominee: null,
        notes: null,
        contribution_frequency: "Monthly",
        contribution_amount: 5000,
        contribution_day: null,
        contribution_month: null,
        employer: null,
        uan: null,
        employee_contribution: null,
        employer_contribution: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ] satisfies RetirementAccount[]);
    getGoldHoldingsMock.mockResolvedValueOnce([
      {
        id: "gold-1",
        description: "Gold Coins",
        holding_type: "Physical Gold",
        current_value: 450000,
      },
    ]);
    getSilverHoldingsMock.mockResolvedValueOnce([
      {
        id: "silver-1",
        description: "Silver Bars",
        holding_type: "Physical Silver",
        current_value: 62000,
      },
    ]);

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("3. Retirement Account Updates")).toBeTruthy();
    expect(screen.getByText("4. Non-Financial Asset Updates")).toBeTruthy();
    expect(screen.getByLabelText("Retirement balance EPF EPFO")).toBeTruthy();
    expect(screen.getByLabelText("Gold value Gold Coins")).toBeTruthy();
    expect(screen.getByLabelText("Silver value Silver Bars")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Retirement balance EPF EPFO"), { target: { value: "110000" } });
    fireEvent.change(screen.getByLabelText("Gold value Gold Coins"), { target: { value: "455000" } });
    fireEvent.change(screen.getByLabelText("Silver value Silver Bars"), { target: { value: "65000" } });

    expect((screen.getByLabelText("Retirement balance EPF EPFO") as HTMLInputElement).value).toBe("110000");
    expect((screen.getByLabelText("Gold value Gold Coins") as HTMLInputElement).value).toBe("455000");
    expect((screen.getByLabelText("Silver value Silver Bars") as HTMLInputElement).value).toBe("65000");
  });

  it("blocks close when required retirement step is incomplete", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValue(buildWorkspace());

    render(<MonthlyReviewPage />);

    await screen.findByText("Projection Comparison");
    fireEvent.click(screen.getByText("Mark Reviewed"));
    fireEvent.click(screen.getByText("Save Financial Asset Updates"));
    await waitFor(() => expect(screen.getByText("Financial asset balances captured for month-end reconciliation.")).toBeTruthy());
    fireEvent.click(screen.getByText("Save Non-Financial Asset Updates"));
    await waitFor(() => expect(screen.getByText("Non-financial asset values updated successfully.")).toBeTruthy());
    fireEvent.click(screen.getByText("Save Liability Updates"));
    await waitFor(() => expect(screen.getByText("Liability balances reviewed successfully.")).toBeTruthy());
    fireEvent.click(screen.getByText("Mark Summary Reviewed"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Close Month"));

    await waitFor(() => {
      expect(closeMonthEndCloseMock).not.toHaveBeenCalled();
    });
  });

  it("allows close without living expenses when all required steps are complete", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValue(buildWorkspace());

    render(<MonthlyReviewPage />);

    await screen.findByText("Projection Comparison");
    fireEvent.click(screen.getByText("Mark Reviewed"));
    fireEvent.click(screen.getByText("Save Financial Asset Updates"));
    await waitFor(() => expect(screen.getByText("Financial asset balances captured for month-end reconciliation.")).toBeTruthy());
    fireEvent.click(screen.getByText("Save Retirement Updates"));
    await waitFor(() => expect(screen.getByText("Retirement balances synced to month-end review.")).toBeTruthy());
    fireEvent.click(screen.getByText("Save Non-Financial Asset Updates"));
    await waitFor(() => expect(screen.getByText("Non-financial asset values updated successfully.")).toBeTruthy());
    fireEvent.click(screen.getByText("Save Liability Updates"));
    await waitFor(() => expect(screen.getByText("Liability balances reviewed successfully.")).toBeTruthy());
    fireEvent.click(screen.getByText("Mark Summary Reviewed"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Close Month"));

    await waitFor(() => {
      expect(closeMonthEndCloseMock).toHaveBeenCalled();
    });
  });

  it("shows N/A month-over-month when no prior closed baseline is available", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace({
      latestClose: null,
      dashboard: {
        ...buildWorkspace().dashboard,
        currentClosedMonth: null,
        monthOverMonthChange: null,
      },
    }));

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("7. Financial Summary")).toBeTruthy();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.getByText("No prior closed month available for MoM baseline.")).toBeTruthy();
  });

  it("renders net worth breakdown buckets and reconciles totals", async () => {
    calculateVarianceSummaryMock.mockReturnValueOnce({
      actualKpis: {
        cash: 100,
        mutualFunds: 200,
        totalAssets: 7600,
        totalLiabilities: 390,
        netWorth: 7210,
        totalsByKey: {
          bank_accounts: 100,
          mutual_funds: 200,
          stocks: 300,
          gold: 900,
          silver: 1000,
          fixed_deposits: 700,
          epf: 400,
          ppf: 500,
          nps: 600,
          real_estate: 800,
          other_assets: 1100,
          home_loans: 120,
          car_loans: 130,
          other_liabilities: 140,
        },
      },
      projectedKpis: {
        cash: 100,
        mutualFunds: 200,
        totalAssets: 7500,
        totalLiabilities: 390,
        netWorth: 7110,
        totalsByKey: {
          bank_accounts: 100,
          mutual_funds: 200,
          stocks: 300,
          gold: 900,
          silver: 1000,
          fixed_deposits: 700,
          epf: 400,
          ppf: 500,
          nps: 600,
          real_estate: 800,
          other_assets: 1100,
          home_loans: 120,
          car_loans: 130,
          other_liabilities: 140,
        },
      },
      projectionVariance: 100,
    });
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace());

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("Net Worth Breakdown (Canonical Sources)")).toBeTruthy();
    expect(screen.getAllByText("Cash / Bank").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mutual Funds").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stocks").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EPF").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PPF").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NPS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fixed Deposits / Bonds").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Property").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gold").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Silver").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vehicle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Other Assets").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total Assets").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Home Loans").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Car Loans").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Credit Cards").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overdraft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Other Liabilities").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total Liabilities").length).toBeGreaterThan(0);

    expect(screen.getByText(/Rendered asset bucket sum:/)).toBeTruthy();
    expect(screen.getByText(/Rendered liability bucket sum:/)).toBeTruthy();
    expect(screen.getByText(/Net Worth check:/)).toBeTruthy();

    expect(screen.getAllByText("month_end_close_items canonical bucket: bank_accounts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("month_end_close_items canonical bucket: epf").length).toBeGreaterThan(0);
    expect(screen.getAllByText("month_end_close_items canonical bucket: home_loans").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\+ month_end_close_items/)).toBeNull();
  });

  it("uses workspace month-end bucket values without adding live source values", async () => {
    const cashFromClose = 6697693;
    const epfFromClose = 18942389;
    const propertyFromClose = 32000000;
    const liabilitiesFromClose = 9376770;

    calculateVarianceSummaryMock.mockReturnValueOnce({
      actualKpis: {
        cash: cashFromClose,
        mutualFunds: 5950786,
        totalAssets: 72199062,
        totalLiabilities: liabilitiesFromClose,
        netWorth: 62822292,
        totalsByKey: {
          bank_accounts: cashFromClose,
          mutual_funds: 5950786,
          stocks: 1280367,
          gold: 4450000,
          silver: 0,
          fixed_deposits: 0,
          epf: epfFromClose,
          ppf: 2023378,
          nps: 455522,
          real_estate: propertyFromClose,
          other_assets: 1198927,
          home_loans: 9175517,
          car_loans: 0,
          other_liabilities: 201253,
        },
      },
      projectedKpis: {
        cash: cashFromClose,
        mutualFunds: 5950786,
        totalAssets: 70000000,
        totalLiabilities: liabilitiesFromClose,
        netWorth: 60623230,
        totalsByKey: {
          bank_accounts: cashFromClose,
          mutual_funds: 5950786,
          stocks: 1280367,
          gold: 4450000,
          silver: 0,
          fixed_deposits: 0,
          epf: epfFromClose,
          ppf: 2023378,
          nps: 455522,
          real_estate: propertyFromClose,
          other_assets: 1198927,
          home_loans: 9175517,
          car_loans: 0,
          other_liabilities: 201253,
        },
      },
      projectionVariance: 2199062,
    });

    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace());
    getBankAccountsMock.mockResolvedValueOnce([
      { id: "bank-1", account_name: "Primary", bank: "HDFC", account_type: "Savings", current_balance: cashFromClose },
    ]);
    getRetirementAccountsMock.mockResolvedValueOnce([
      {
        id: "epf-1",
        user_id: "user-1",
        account_type: "EPF",
        owner: "Self",
        institution: "EPFO",
        current_balance: epfFromClose,
        account_number: null,
        opening_date: null,
        interest_rate: null,
        nominee: null,
        notes: null,
        contribution_frequency: "Monthly",
        contribution_amount: 0,
        contribution_day: null,
        contribution_month: null,
        employer: null,
        uan: null,
        employee_contribution: null,
        employer_contribution: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ] satisfies RetirementAccount[]);
    getRealEstatePropertiesMock.mockResolvedValueOnce([
      { id: "re-1", property_name: "Home", city: "Mumbai", state: "MH", current_market_value: propertyFromClose },
    ]);

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("Net Worth Breakdown (Canonical Sources)")).toBeTruthy();

    const cashRows = screen.getAllByText("Cash / Bank");
    expect(cashRows.length).toBeGreaterThan(0);
    const cashRowText = cashRows[0].closest("tr")?.textContent ?? cashRows[0].parentElement?.textContent ?? "";
    expect(cashRowText).toContain("66,97,693");
    expect(cashRowText).not.toContain("1,33,95,386");

    const epfRows = screen.getAllByText("EPF");
    const epfRowText = epfRows[0].closest("tr")?.textContent ?? epfRows[0].parentElement?.textContent ?? "";
    expect(epfRowText).toContain("1,89,42,389");
    expect(epfRowText).not.toContain("3,78,84,778");

    const breakdownSection = screen.getByText("Net Worth Breakdown (Canonical Sources)").closest("section")?.textContent ?? "";
    expect(breakdownSection).toContain("Rendered asset bucket sum:");
    expect(breakdownSection).toContain("Rendered liability bucket sum:");
    expect(breakdownSection).toContain("Net Worth check:");
  });

  it("renders duplicate exposure warnings in financial summary audit", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace());
    getRetirementAccountsMock.mockResolvedValueOnce([
      {
        id: "epf-1",
        user_id: "user-1",
        account_type: "EPF",
        owner: "Self",
        institution: "EPFO",
        current_balance: 100000,
        account_number: null,
        opening_date: null,
        interest_rate: null,
        nominee: null,
        notes: null,
        contribution_frequency: "Monthly",
        contribution_amount: 0,
        contribution_day: null,
        contribution_month: null,
        employer: null,
        uan: null,
        employee_contribution: null,
        employer_contribution: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ] satisfies RetirementAccount[]);
    getInvestmentsMock.mockResolvedValueOnce([
      { id: "inv-epf", category: "EPF", current_value: 100000, status: "active", investment_name: "EPF Investment" },
      { id: "inv-gold", category: "Gold", current_value: 250000, status: "active", investment_name: "Gold ETF" },
      { id: "inv-silver", category: "Silver", current_value: 90000, status: "active", investment_name: "Silver ETF" },
    ]);
    getGoldHoldingsMock.mockResolvedValueOnce([
      { id: "gold-1", description: "Gold Coins", holding_type: "Physical Gold", current_value: 250000 },
    ]);
    getSilverHoldingsMock.mockResolvedValueOnce([
      { id: "silver-1", description: "Silver Bars", holding_type: "Physical Silver", current_value: 90000 },
    ]);

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("Potential Duplicate Exposure")).toBeTruthy();
    expect(screen.getByText("EPF duplicate exposure")).toBeTruthy();
    expect(screen.getByText("Gold duplicate exposure")).toBeTruthy();
    expect(screen.getByText("Silver duplicate exposure")).toBeTruthy();
    expect(screen.getByText("Ignored Duplicate Sources")).toBeTruthy();
    expect(screen.getByText("EPF also exists in investment holdings but was ignored because retirement accounts are canonical.")).toBeTruthy();
  });

  it("excludes EPF and gold/silver investments from Financial Asset updates when dedicated modules exist", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace());
    getRetirementAccountsMock.mockResolvedValueOnce([
      {
        id: "epf-1",
        user_id: "user-1",
        account_type: "EPF",
        owner: "Self",
        institution: "EPFO",
        current_balance: 100000,
        account_number: null,
        opening_date: null,
        interest_rate: null,
        nominee: null,
        notes: null,
        contribution_frequency: "Monthly",
        contribution_amount: 0,
        contribution_day: null,
        contribution_month: null,
        employer: null,
        uan: null,
        employee_contribution: null,
        employer_contribution: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ] satisfies RetirementAccount[]);
    getGoldHoldingsMock.mockResolvedValueOnce([
      { id: "gold-1", description: "Gold Coins", holding_type: "Physical Gold", current_value: 250000 },
    ]);
    getSilverHoldingsMock.mockResolvedValueOnce([
      { id: "silver-1", description: "Silver Bars", holding_type: "Physical Silver", current_value: 90000 },
    ]);
    getInvestmentsMock.mockResolvedValueOnce([
      { id: "inv-mf", category: "Mutual Funds", current_value: 100000, status: "active", investment_name: "MF 1" },
      { id: "inv-epf", category: "EPF", current_value: 100000, status: "active", investment_name: "EPF Investment" },
      { id: "inv-gold", category: "Gold", current_value: 250000, status: "active", investment_name: "Gold ETF" },
      { id: "inv-silver", category: "Silver", current_value: 90000, status: "active", investment_name: "Silver ETF" },
    ]);

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("2. Financial Asset Updates")).toBeTruthy();
    expect(screen.queryByLabelText("Investment value EPF Investment")).toBeNull();
    expect(screen.queryByLabelText("Investment value Gold ETF")).toBeNull();
    expect(screen.queryByLabelText("Investment value Silver ETF")).toBeNull();

    fireEvent.change(screen.getByLabelText("Mutual Funds Total"), { target: { value: "120000" } });
    fireEvent.click(screen.getByText("Save Financial Asset Updates"));

    await waitFor(() => {
      expect(saveMonthEndCloseDraftMock).toHaveBeenCalled();
    });

    const updatedInvestmentIds = updateInvestmentMock.mock.calls
      .map((call) => call[0] as { id: string })
      .map((payload) => payload.id);

    expect(updatedInvestmentIds).toContain("inv-mf");
    expect(updatedInvestmentIds).not.toContain("inv-epf");
    expect(updatedInvestmentIds).not.toContain("inv-gold");
    expect(updatedInvestmentIds).not.toContain("inv-silver");
  });

  it("syncs retirement save to month-end draft rows and refreshed breakdown values", async () => {
    const firstWorkspace = buildWorkspace({
      items: [
        buildWorkspaceItem({ rowKey: "retirement-account:epf-1", entityId: "epf-1", entityType: "retirement-account", entityTypeLabel: "EPF", entityName: "Self • EPFO", key: "epf", actualValue: 18942389 }),
        buildWorkspaceItem({ rowKey: "retirement-account:nps-1", entityId: "nps-1", entityType: "retirement-account", entityTypeLabel: "NPS", entityName: "Self • NPS", key: "nps", actualValue: 455522 }),
      ],
    });
    const secondWorkspace = buildWorkspace({
      items: [
        buildWorkspaceItem({ rowKey: "retirement-account:epf-1", entityId: "epf-1", entityType: "retirement-account", entityTypeLabel: "EPF", entityName: "Self • EPFO", key: "epf", actualValue: 18886844 }),
        buildWorkspaceItem({ rowKey: "retirement-account:nps-1", entityId: "nps-1", entityType: "retirement-account", entityTypeLabel: "NPS", entityName: "Self • NPS", key: "nps", actualValue: 525712 }),
      ],
    });

    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(firstWorkspace).mockResolvedValueOnce(secondWorkspace);
    getRetirementAccountsMock.mockResolvedValue([
      {
        id: "epf-1",
        user_id: "user-1",
        account_type: "EPF",
        owner: "Self",
        institution: "EPFO",
        current_balance: 18942389,
        account_number: null,
        opening_date: null,
        interest_rate: null,
        nominee: null,
        notes: null,
        contribution_frequency: "Monthly",
        contribution_amount: 0,
        contribution_day: null,
        contribution_month: null,
        employer: null,
        uan: null,
        employee_contribution: null,
        employer_contribution: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "nps-1",
        user_id: "user-1",
        account_type: "NPS",
        owner: "Self",
        institution: "NPS",
        current_balance: 455522,
        account_number: null,
        opening_date: null,
        interest_rate: null,
        nominee: null,
        notes: null,
        contribution_frequency: "Monthly",
        contribution_amount: 0,
        contribution_day: null,
        contribution_month: null,
        pran: null,
        pop: null,
        equity_percent: null,
        corporate_debt_percent: null,
        government_securities_percent: null,
        alternative_assets_percent: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ] satisfies RetirementAccount[]);

    calculateVarianceSummaryMock
      .mockReturnValueOnce({
        actualKpis: {
          cash: 0,
          mutualFunds: 0,
          totalAssets: 20000000,
          totalLiabilities: 0,
          netWorth: 20000000,
          totalsByKey: {
            bank_accounts: 0,
            mutual_funds: 0,
            stocks: 0,
            gold: 0,
            silver: 0,
            fixed_deposits: 0,
            epf: 18942389,
            ppf: 0,
            nps: 455522,
            real_estate: 0,
            other_assets: 0,
            home_loans: 0,
            car_loans: 0,
            other_liabilities: 0,
          },
        },
        projectedKpis: {
          cash: 0,
          mutualFunds: 0,
          totalAssets: 20000000,
          totalLiabilities: 0,
          netWorth: 20000000,
          totalsByKey: {
            bank_accounts: 0,
            mutual_funds: 0,
            stocks: 0,
            gold: 0,
            silver: 0,
            fixed_deposits: 0,
            epf: 18942389,
            ppf: 0,
            nps: 455522,
            real_estate: 0,
            other_assets: 0,
            home_loans: 0,
            car_loans: 0,
            other_liabilities: 0,
          },
        },
        projectionVariance: 0,
      })
      .mockReturnValueOnce({
        actualKpis: {
          cash: 0,
          mutualFunds: 0,
          totalAssets: 20000000,
          totalLiabilities: 0,
          netWorth: 20000000,
          totalsByKey: {
            bank_accounts: 0,
            mutual_funds: 0,
            stocks: 0,
            gold: 0,
            silver: 0,
            fixed_deposits: 0,
            epf: 18886844,
            ppf: 0,
            nps: 525712,
            real_estate: 0,
            other_assets: 0,
            home_loans: 0,
            car_loans: 0,
            other_liabilities: 0,
          },
        },
        projectedKpis: {
          cash: 0,
          mutualFunds: 0,
          totalAssets: 20000000,
          totalLiabilities: 0,
          netWorth: 20000000,
          totalsByKey: {
            bank_accounts: 0,
            mutual_funds: 0,
            stocks: 0,
            gold: 0,
            silver: 0,
            fixed_deposits: 0,
            epf: 18886844,
            ppf: 0,
            nps: 525712,
            real_estate: 0,
            other_assets: 0,
            home_loans: 0,
            car_loans: 0,
            other_liabilities: 0,
          },
        },
        projectionVariance: 0,
      });

    render(<MonthlyReviewPage />);

    await screen.findByText("3. Retirement Account Updates");
    fireEvent.change(screen.getByLabelText("Retirement balance EPF EPFO"), { target: { value: "18886844" } });
    fireEvent.change(screen.getByLabelText("Retirement balance NPS NPS"), { target: { value: "525712" } });
    fireEvent.click(screen.getByText("Save Retirement Updates"));

    await waitFor(() => {
      expect(updateRetirementAccountMock).toHaveBeenCalled();
      expect(saveMonthEndCloseDraftMock).toHaveBeenCalled();
    });

    const latestPayload = saveMonthEndCloseDraftMock.mock.calls.at(-1)?.[0] as { items: Array<{ entityType: string; entityId: string; actualValue: number }> };
    expect(latestPayload.items.find((item) => item.entityType === "retirement-account" && item.entityId === "epf-1")?.actualValue).toBe(18886844);
    expect(latestPayload.items.find((item) => item.entityType === "retirement-account" && item.entityId === "nps-1")?.actualValue).toBe(525712);

    expect(screen.getByText("₹1,88,86,844")).toBeTruthy();
    expect(screen.getByText("₹5,25,712")).toBeTruthy();
  });

  it("renders and saves gold/silver rows in non-financial updates and syncs breakdown", async () => {
    const firstWorkspace = buildWorkspace({
      items: [
        buildWorkspaceItem({ rowKey: "gold-holding:gold-1", entityId: "gold-1", entityType: "gold-holding", entityTypeLabel: "Physical Gold", entityName: "Gold Coins", key: "gold", actualValue: 4450000 }),
        buildWorkspaceItem({ rowKey: "silver-holding:silver-1", entityId: "silver-1", entityType: "silver-holding", entityTypeLabel: "Physical Silver", entityName: "Silver Bars", key: "silver", actualValue: 90000 }),
      ],
    });
    const secondWorkspace = buildWorkspace({
      items: [
        buildWorkspaceItem({ rowKey: "gold-holding:gold-1", entityId: "gold-1", entityType: "gold-holding", entityTypeLabel: "Physical Gold", entityName: "Gold Coins", key: "gold", actualValue: 4300000 }),
        buildWorkspaceItem({ rowKey: "silver-holding:silver-1", entityId: "silver-1", entityType: "silver-holding", entityTypeLabel: "Physical Silver", entityName: "Silver Bars", key: "silver", actualValue: 120000 }),
      ],
    });

    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(firstWorkspace).mockResolvedValueOnce(secondWorkspace);
    getGoldHoldingsMock.mockResolvedValue([
      { id: "gold-1", description: "Gold Coins", holding_type: "Physical Gold", current_value: 4450000, owner: "Self" },
    ]);
    getSilverHoldingsMock.mockResolvedValue([
      { id: "silver-1", description: "Silver Bars", holding_type: "Physical Silver", current_value: 90000, owner: "Self" },
    ]);

    calculateVarianceSummaryMock
      .mockReturnValueOnce({
        actualKpis: {
          cash: 0,
          mutualFunds: 0,
          totalAssets: 4540000,
          totalLiabilities: 0,
          netWorth: 4540000,
          totalsByKey: {
            bank_accounts: 0,
            mutual_funds: 0,
            stocks: 0,
            gold: 4450000,
            silver: 90000,
            fixed_deposits: 0,
            epf: 0,
            ppf: 0,
            nps: 0,
            real_estate: 0,
            other_assets: 0,
            home_loans: 0,
            car_loans: 0,
            other_liabilities: 0,
          },
        },
        projectedKpis: {
          cash: 0,
          mutualFunds: 0,
          totalAssets: 4540000,
          totalLiabilities: 0,
          netWorth: 4540000,
          totalsByKey: {
            bank_accounts: 0,
            mutual_funds: 0,
            stocks: 0,
            gold: 4450000,
            silver: 90000,
            fixed_deposits: 0,
            epf: 0,
            ppf: 0,
            nps: 0,
            real_estate: 0,
            other_assets: 0,
            home_loans: 0,
            car_loans: 0,
            other_liabilities: 0,
          },
        },
        projectionVariance: 0,
      })
      .mockReturnValueOnce({
        actualKpis: {
          cash: 0,
          mutualFunds: 0,
          totalAssets: 4420000,
          totalLiabilities: 0,
          netWorth: 4420000,
          totalsByKey: {
            bank_accounts: 0,
            mutual_funds: 0,
            stocks: 0,
            gold: 4300000,
            silver: 120000,
            fixed_deposits: 0,
            epf: 0,
            ppf: 0,
            nps: 0,
            real_estate: 0,
            other_assets: 0,
            home_loans: 0,
            car_loans: 0,
            other_liabilities: 0,
          },
        },
        projectedKpis: {
          cash: 0,
          mutualFunds: 0,
          totalAssets: 4420000,
          totalLiabilities: 0,
          netWorth: 4420000,
          totalsByKey: {
            bank_accounts: 0,
            mutual_funds: 0,
            stocks: 0,
            gold: 4300000,
            silver: 120000,
            fixed_deposits: 0,
            epf: 0,
            ppf: 0,
            nps: 0,
            real_estate: 0,
            other_assets: 0,
            home_loans: 0,
            car_loans: 0,
            other_liabilities: 0,
          },
        },
        projectionVariance: 0,
      });

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("4. Non-Financial Asset Updates")).toBeTruthy();
    expect(screen.getByLabelText("Gold value Gold Coins")).toBeTruthy();
    expect(screen.getByLabelText("Silver value Silver Bars")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Gold value Gold Coins"), { target: { value: "4300000" } });
    fireEvent.change(screen.getByLabelText("Silver value Silver Bars"), { target: { value: "120000" } });
    fireEvent.click(screen.getByText("Save Non-Financial Asset Updates"));

    await waitFor(() => {
      expect(updateGoldHoldingMock).toHaveBeenCalled();
      expect(updateSilverHoldingMock).toHaveBeenCalled();
      expect(saveMonthEndCloseDraftMock).toHaveBeenCalled();
    });

    const latestPayload = saveMonthEndCloseDraftMock.mock.calls.at(-1)?.[0] as { items: Array<{ entityType: string; entityId: string; actualValue: number }> };
    expect(latestPayload.items.find((item) => item.entityType === "gold-holding" && item.entityId === "gold-1")?.actualValue).toBe(4300000);
    expect(latestPayload.items.find((item) => item.entityType === "silver-holding" && item.entityId === "silver-1")?.actualValue).toBe(120000);

    expect(screen.getByText("₹43,00,000")).toBeTruthy();
    expect(screen.getByText("₹1,20,000")).toBeTruthy();
  });

  it("shows add controls and creates missing gold/silver holdings from prior close values", async () => {
    getMonthEndCloseWorkspaceMock
      .mockResolvedValueOnce(buildWorkspace({
        items: [
          {
            rowKey: "gold-holding:ghost-gold",
            entityId: "ghost-gold",
            entityType: "gold-holding",
            entityTypeLabel: "Physical Gold",
            entityName: "Gold at home",
            key: "gold",
            label: "Gold at home",
            itemType: "asset",
            sortOrder: 1,
            openingValue: 75000,
            projectedValue: 75000,
            actualValue: 0,
            absoluteVariance: -75000,
            percentageVariance: -100,
          },
          {
            rowKey: "silver-holding:ghost-silver",
            entityId: "ghost-silver",
            entityType: "silver-holding",
            entityTypeLabel: "Physical Silver",
            entityName: "Silver holding",
            key: "silver",
            label: "Silver holding",
            itemType: "asset",
            sortOrder: 1,
            openingValue: 12000,
            projectedValue: 12000,
            actualValue: 0,
            absoluteVariance: -12000,
            percentageVariance: -100,
          },
        ],
      }))
      .mockResolvedValueOnce(buildWorkspace({
        items: [
          buildWorkspaceItem({ rowKey: "gold-holding:gold-created", entityId: "gold-created", entityType: "gold-holding", entityTypeLabel: "Physical Gold", entityName: "Gold at home", key: "gold", actualValue: 75000 }),
          buildWorkspaceItem({ rowKey: "silver-holding:silver-created", entityId: "silver-created", entityType: "silver-holding", entityTypeLabel: "Physical Silver", entityName: "Silver holding", key: "silver", actualValue: 12000 }),
        ],
      }))
      .mockResolvedValueOnce(buildWorkspace({
        items: [
          buildWorkspaceItem({ rowKey: "gold-holding:gold-created", entityId: "gold-created", entityType: "gold-holding", entityTypeLabel: "Physical Gold", entityName: "Gold at home", key: "gold", actualValue: 75000 }),
          buildWorkspaceItem({ rowKey: "silver-holding:silver-created", entityId: "silver-created", entityType: "silver-holding", entityTypeLabel: "Physical Silver", entityName: "Silver holding", key: "silver", actualValue: 12000 }),
        ],
      }));

    createGoldHoldingMock.mockResolvedValueOnce({
      id: "gold-created",
      description: "Gold at home",
      holding_type: "Physical Gold",
      current_value: 75000,
      owner: "Household",
    });

    createSilverHoldingMock.mockResolvedValueOnce({
      id: "silver-created",
      description: "Silver holding",
      holding_type: "Physical Silver",
      current_value: 12000,
      owner: "Household",
    });

    render(<MonthlyReviewPage />);

    expect(await screen.findByText("4. Non-Financial Asset Updates")).toBeTruthy();
    expect(screen.getByText("Add Gold Holding")).toBeTruthy();
    expect(screen.getByText("Add Silver Holding")).toBeTruthy();
    expect(screen.getAllByText("Create holding from prior close").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText("Create holding from prior close")[0]);
    fireEvent.click(screen.getAllByText("Create holding from prior close")[1]);

    expect((screen.getByLabelText("New gold holding value") as HTMLInputElement).value).toBe("75000");
    expect((screen.getByLabelText("New silver holding value") as HTMLInputElement).value).toBe("12000");

    fireEvent.click(screen.getByText("Save Non-Financial Asset Updates"));

    await waitFor(() => {
      expect(createGoldHoldingMock).toHaveBeenCalledWith(expect.objectContaining({
        description: "Gold at home",
        current_value: 75000,
      }));
      expect(createSilverHoldingMock).toHaveBeenCalledWith(expect.objectContaining({
        description: "Silver holding",
        current_value: 12000,
      }));
      expect(saveMonthEndCloseDraftMock).toHaveBeenCalled();
    });

    const latestPayload = saveMonthEndCloseDraftMock.mock.calls.at(-1)?.[0] as { items: Array<{ entityType: string; entityId: string; actualValue: number }> };
    expect(latestPayload.items.find((item) => item.entityType === "gold-holding" && item.entityId === "gold-created")?.actualValue).toBe(75000);
    expect(latestPayload.items.find((item) => item.entityType === "silver-holding" && item.entityId === "silver-created")?.actualValue).toBe(12000);
  });
});

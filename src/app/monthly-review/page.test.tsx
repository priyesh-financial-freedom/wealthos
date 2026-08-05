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
  updateGoldHoldingMock: vi.fn(),
  getSilverHoldingsMock: vi.fn<() => Promise<Array<Record<string, unknown>>>>(),
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
  updateGoldHoldingMock,
  getSilverHoldingsMock,
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
  updateGoldHoldingMock.mockResolvedValue({});
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
  updateGoldHolding: updateGoldHoldingMock,
}));

vi.mock("@/services/silverHoldings", () => ({
  getSilverHoldings: getSilverHoldingsMock,
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
    await waitFor(() => expect(screen.getByText("Retirement balances reviewed successfully.")).toBeTruthy());
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
  });
});

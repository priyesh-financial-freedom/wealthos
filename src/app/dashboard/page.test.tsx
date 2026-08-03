// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";

const getBalanceSheetData = vi.fn();
const loadHistory = vi.fn();
const getAssumptionsBundle = vi.fn();
const getCashFlowSummary = vi.fn();
const listGoals = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: unknown; href: string; className?: string }) => <a href={href} className={className}>{children}</a>,
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/ContentContainer", () => ({
  ContentContainer: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/PageBreadcrumb", () => ({
  PageBreadcrumb: () => <div>breadcrumb</div>,
}));

vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock("@/services/balanceSheet", () => ({
  getBalanceSheetData,
}));

vi.mock("@/services/snapshots", () => ({
  snapshotReadModel: {
    loadHistory,
  },
}));

vi.mock("@/services/assumptions", () => ({
  DEFAULT_SCENARIO_KEY: "default",
  assumptionsService: {
    getAssumptionsBundle,
  },
}));

vi.mock("@/services/cashFlowManagement", () => ({
  cashFlowManagementService: {
    getCashFlowSummary,
  },
}));

vi.mock("@/services/planning/goals", () => ({
  goalService: {
    listGoals,
  },
}));

function makeBalanceSheetData() {
  return {
    assets: [],
    investments: [],
    bankAccounts: [],
    retirementAccounts: [],
    fixedDeposits: [],
    goldHoldings: [],
    silverHoldings: [],
    realEstateProperties: [],
    liabilities: [
      { liability_type: "Home Loan", outstanding_amount: 5000000 },
      { liability_type: "Car Loan", outstanding_amount: 600000 },
      { liability_type: "Bank Overdraft", outstanding_amount: 120000 },
      { liability_type: "Credit Card", outstanding_amount: 50000 },
      { liability_type: "Other Liability", outstanding_amount: 30000 },
    ],
    summary: {
      netWorth: 12500000,
      totalBalanceSheetAssets: 18200000,
      totalLiabilities: 5800000,
      categoryTotals: {
        retirement: 3200000,
      },
    },
  };
}

function makeHistory() {
  return [
    { monthLabel: "Jul 2026", totals: { netWorth: 12500000 } },
    { monthLabel: "Jun 2026", totals: { netWorth: 12100000 } },
  ];
}

beforeEach(() => {
  getBalanceSheetData.mockReset();
  loadHistory.mockReset();
  getAssumptionsBundle.mockReset();
  getCashFlowSummary.mockReset();
  listGoals.mockReset();
  fetchMock.mockReset();

  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    if (String(input) === "/api/dashboard/retirement") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          currentRetirementCorpus: 4200000,
          expectedCorpusAtRetirement: 9000000,
          retirementDate: "Jun 2048",
          statusLabel: "Needs Attention",
          detail: "Expected corpus is sourced from the latest LOCKED Rolling projection at your retirement month.",
        }),
      } as Response;
    }

    throw new Error(`Unexpected fetch call: ${String(input)}`);
  });

  getBalanceSheetData.mockResolvedValue(makeBalanceSheetData());
  loadHistory.mockResolvedValue(makeHistory());
  getAssumptionsBundle.mockResolvedValue({
    retirement: { salaryStopMonth: 6, salaryStopYear: 2048 },
  });
  getCashFlowSummary.mockResolvedValue({ savingsRate: 0.24 });
  listGoals.mockResolvedValue([
    { id: "goal-1", name: "emergency fund", target_date: "2027-01-25", status: "ON_TRACK", is_completed: false },
    { id: "goal-2", name: "education", target_date: "2032-04-01", status: "AT_RISK", is_completed: false },
  ]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DashboardPage", () => {
  it("renders the simple dashboard shell and five cards", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Family Dashboard")).toBeTruthy();
    });

    expect(screen.getByRole("heading", { name: "Family Net Worth" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Retirement" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Monthly Review" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Goals" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Debt Snapshot" })).toBeTruthy();
    expect(screen.getByText("₹1,25,00,000")).toBeTruthy();
  });

  it("does not render removed executive widgets on the default dashboard", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Debt Snapshot" })).toBeTruthy();
    });

    expect(screen.queryByText("Financial Health Score")).toBeNull();
    expect(screen.queryByText("Recommended Actions")).toBeNull();
    expect(screen.queryByText("Goal Funding Heatmap")).toBeNull();
    expect(screen.queryByText("Net Worth Trend")).toBeNull();
    expect(screen.queryByText("Asset Allocation Drift")).toBeNull();
  });

  it("keeps the dashboard running when one non-retirement card data source fails", async () => {
    listGoals.mockRejectedValueOnce(new Error("Goals unavailable"));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Data unavailable")).toBeTruthy();
    });

    expect(screen.getByRole("heading", { name: "Family Net Worth" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Retirement" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Debt Snapshot" })).toBeTruthy();
  });

  it("keeps retirement card partial when retirement API fails but balance sheet fallback exists", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "Retirement unavailable" } }),
    }) as Response);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Current Corpus")).toBeTruthy();
    });

    expect(screen.getByText("₹32,00,000")).toBeTruthy();
    expect(screen.getByText("Expected Corpus")).toBeTruthy();
    expect(screen.getByText("Set in Assumptions")).toBeTruthy();
    expect(screen.queryByText("Data unavailable")).toBeNull();
  });

  it("shows owner split fallback, hides unreliable goal status counts, and keeps mobile-first layout", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Owner-wise split")).toBeTruthy();
    });

    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.queryByText("Funded Goals")).toBeNull();
    expect(screen.queryByText("At Risk Goals")).toBeNull();
    expect(screen.getByText("Detailed funding status available on Goals page.")).toBeTruthy();
    expect(screen.getByTestId("simple-dashboard-grid").className).toContain("grid-cols-1");
    expect(screen.getByTestId("simple-dashboard-grid").className).toContain("xl:grid-cols-2");
  });

  it("shows a colored monthly review status badge and retirement expected corpus label", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeTruthy();
    });

    expect(screen.getByText("Expected Corpus")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Monthly Review" }).getAttribute("href")).toBe("/monthly-review");
  });

  it("shows partial retirement data when expected corpus is missing", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        currentRetirementCorpus: 4200000,
        expectedCorpusAtRetirement: null,
        retirementDate: "Jun 2048",
        statusLabel: "Data required",
        detail: "Expected corpus uses the latest locked rolling projection at retirement date. Fixed projection is used as fallback.",
      }),
    }) as Response);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Retirement" })).toBeTruthy();
    });

    expect(screen.getByText("Current Corpus")).toBeTruthy();
    expect(screen.getByText("₹42,00,000")).toBeTruthy();
    expect(screen.getByText("Expected Corpus")).toBeTruthy();
    expect(screen.getAllByText("Data required").length).toBeGreaterThan(0);
    expect(screen.getByText("Jun 2048")).toBeTruthy();
    expect(screen.queryByText("Data unavailable")).toBeNull();
  });

  it("shows retirement date fallback as set in assumptions", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        currentRetirementCorpus: 4200000,
        expectedCorpusAtRetirement: null,
        retirementDate: null,
        statusLabel: "Data required",
        detail: "Expected corpus uses the latest locked rolling projection at retirement date. Fixed projection is used as fallback.",
      }),
    }) as Response);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Set in Assumptions")).toBeTruthy();
    });
  });

  it("formats the next goal name and date for display", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeTruthy();
    });

    expect(screen.getByText("25 Jan 2027")).toBeTruthy();
  });
});

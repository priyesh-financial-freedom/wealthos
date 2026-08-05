// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MonthEndCloseWorkspace } from "@/types/monthEndClose";

const monthEndCloseMocks = vi.hoisted(() => ({
  getMonthEndCloseWorkspaceMock: vi.fn<() => Promise<MonthEndCloseWorkspace>>(),
  saveMonthEndCloseDraftMock: vi.fn(),
  closeMonthEndCloseMock: vi.fn(),
  reopenMonthMock: vi.fn(),
}));

const {
  getMonthEndCloseWorkspaceMock,
  saveMonthEndCloseDraftMock,
  closeMonthEndCloseMock,
  reopenMonthMock,
} = monthEndCloseMocks;

let MonthEndClosePage: typeof import("./page").default;

beforeAll(async () => {
  MonthEndClosePage = (await import("./page")).default;
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

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
  Button: ({ children, onClick, disabled, type = "button" }: { children: unknown; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" | "reset" }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
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

vi.mock("@/services/monthEndClose", () => ({
  calculateMonthEndCloseVarianceSummary: () => ({
    actualKpis: {
      netWorth: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      cash: 0,
      mutualFunds: 0,
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
      netWorth: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      cash: 0,
      mutualFunds: 0,
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
    projectionVariance: 0,
  }),
  getMonthEndCloseWorkspace: getMonthEndCloseWorkspaceMock,
  saveMonthEndCloseDraft: saveMonthEndCloseDraftMock,
  closeMonthEndClose: closeMonthEndCloseMock,
  reopenMonth: reopenMonthMock,
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
    items: [
      {
        rowKey: "bank-account:bank-1",
        entityId: "bank-1",
        entityType: "bank-account",
        entityTypeLabel: "Savings",
        entityName: "Primary",
        key: "bank_accounts",
        label: "Primary",
        itemType: "asset",
        sortOrder: 1,
        openingValue: 100,
        projectedValue: 100,
        actualValue: 100,
        absoluteVariance: 0,
        percentageVariance: 0,
      },
    ],
    dashboard: {
      currentClosedMonth: { month: 7, year: 2026, monthKey: "2026-07", label: "July 2026" },
      pendingMonth: { month: 8, year: 2026, monthKey: "2026-08", label: "August 2026" },
      totalAssets: 100,
      totalLiabilities: 0,
      netWorth: 100,
      monthOverMonthChange: 0,
      projectionVariance: 0,
      largestPositiveVariance: null,
      largestNegativeVariance: null,
    },
    ...overrides,
  };
}

describe("MonthEndClosePage", () => {
  it("shows Reopen Month for latest closed workspace and hides save/close controls", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(
      buildWorkspace({
        status: "closed",
        close: {
          ...buildWorkspace().close,
          id: "c826b7f9-e0ab-4b31-96e3-6275a09e767c",
          close_month: 7,
          status: "closed",
          closed_at: "2026-07-31T00:00:00.000Z",
        },
        month: { month: 7, year: 2026, monthKey: "2026-07", label: "July 2026" },
      }),
    );

    render(<MonthEndClosePage />);

    expect(await screen.findByText("This month is closed. Reopen it to make corrections.")).toBeTruthy();
    expect(screen.getByText("Reopen July 2026")).toBeTruthy();
    expect(screen.queryByText("Save Draft")).toBeNull();
    expect(screen.queryByText("Close Month")).toBeNull();
  });

  it("shows pending workspace CTA to reopen latest closed month", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace({ status: "draft" }));

    render(<MonthEndClosePage />);

    expect(await screen.findByText("Need to correct the previous closed month?")).toBeTruthy();
    expect(screen.getByText("Reopen July 2026")).toBeTruthy();
  });

  it("shows older closed month lock message and no reopen button", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(
      buildWorkspace({
        status: "closed",
        close: {
          ...buildWorkspace().close,
          id: "close-0",
          status: "closed",
          closed_at: "2026-07-31T00:00:00.000Z",
        },
        latestClose: {
          ...buildWorkspace().latestClose,
          id: "close-1",
        },
      }),
    );

    render(<MonthEndClosePage />);

    expect(await screen.findByText("Older closed months are locked. Only the latest closed month can be reopened.")).toBeTruthy();
    expect(screen.queryByText("Reopen Month")).toBeNull();
    expect(screen.queryByText("Save Draft")).toBeNull();
    expect(screen.queryByText("Close Month")).toBeNull();
  });

  it("requires reopen reason", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(
      buildWorkspace({
        status: "closed",
        close: {
          ...buildWorkspace().close,
          id: "c826b7f9-e0ab-4b31-96e3-6275a09e767c",
          close_month: 7,
          status: "closed",
          closed_at: "2026-07-31T00:00:00.000Z",
        },
        month: { month: 7, year: 2026, monthKey: "2026-07", label: "July 2026" },
      }),
    );

    render(<MonthEndClosePage />);

    fireEvent.click(await screen.findByText("Reopen July 2026"));
    fireEvent.click(screen.getByText("Reopen"));

    expect((await screen.findAllByText("A reason is required to reopen the month.")).length).toBeGreaterThan(0);
    expect(reopenMonthMock).not.toHaveBeenCalled();
  });

  it("reopens latest closed month and reloads workspace", async () => {
    getMonthEndCloseWorkspaceMock
      .mockResolvedValueOnce(
        buildWorkspace({
          status: "draft",
        }),
      )
      .mockResolvedValueOnce(buildWorkspace({ status: "draft" }));

    reopenMonthMock.mockResolvedValueOnce({});

    render(<MonthEndClosePage />);

    fireEvent.click(await screen.findByText("Reopen July 2026"));
    fireEvent.change(screen.getByPlaceholderText("Enter reason"), {
      target: { value: "Corrected investment valuation" },
    });
    fireEvent.click(screen.getByText("Reopen"));

    await waitFor(() => {
      expect(reopenMonthMock).toHaveBeenCalledWith({
        closeId: "c826b7f9-e0ab-4b31-96e3-6275a09e767c",
        reason: "Corrected investment valuation",
      });
    });

    await waitFor(() => {
      expect(getMonthEndCloseWorkspaceMock).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText("July 2026 has been reopened for corrections.")).toBeTruthy();
    expect(screen.getByText("Save Draft")).toBeTruthy();
    expect(screen.getByText("Close Month")).toBeTruthy();
  });

  it("does not show latest closed reopen CTA when latestClose is null", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace({ latestClose: null }));

    render(<MonthEndClosePage />);

    await screen.findByText("Month-End Close");
    expect(screen.queryByText("Need to correct the previous closed month?")).toBeNull();
    expect(screen.queryByText("Reopen July 2026")).toBeNull();
  });

  it("disables row inputs when workspace is closed", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(
      buildWorkspace({
        status: "closed",
        close: {
          ...buildWorkspace().close,
          status: "closed",
          closed_at: "2026-08-31T00:00:00.000Z",
        },
      }),
    );

    render(<MonthEndClosePage />);

    const inputs = await screen.findAllByRole("spinbutton");
    expect(inputs.length).toBeGreaterThan(0);
    expect((inputs[0] as HTMLInputElement).disabled).toBe(true);
  });

  it("maps immutable close errors to reopen guidance", async () => {
    getMonthEndCloseWorkspaceMock.mockResolvedValueOnce(buildWorkspace({ status: "draft" }));
    closeMonthEndCloseMock.mockRejectedValueOnce(new Error("Closed month-end closes are immutable. Create a new version instead."));

    render(<MonthEndClosePage />);

    fireEvent.click(await screen.findByText("Close Month"));

    expect((await screen.findAllByText("This month is already closed. Use Reopen Month to make corrections.")).length).toBeGreaterThan(0);
  });
});

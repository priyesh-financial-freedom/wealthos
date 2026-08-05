// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MonthEndCloseWorkspace } from "@/types/monthEndClose";

let MonthlyReviewPage: typeof import("./page").default;

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

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
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
  getInvestments: async () => [],
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
  calculateMonthEndCloseVarianceSummary: () => null,
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
  getRetirementAccounts: async () => [],
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
});

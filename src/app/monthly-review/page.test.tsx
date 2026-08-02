// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MonthlyReviewPage from "./page";

afterEach(() => {
  cleanup();
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
  Button: ({ children }: { children: unknown }) => <button type="button">{children}</button>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: unknown }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: unknown }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: unknown }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: unknown }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/feedback", () => ({
  LoadingSpinner: ({ label }: { label?: string }) => <div>{label}</div>,
  ToastViewport: () => null,
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
  getMonthEndCloseWorkspace: async () => ({
    close: null,
    latestClose: null,
    month: { month: 8, year: 2026, monthKey: "2026-08", label: "August 2026" },
    status: "draft",
    items: [],
    dashboard: {
      currentClosedMonth: null,
      pendingMonth: { month: 8, year: 2026, monthKey: "2026-08", label: "August 2026" },
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      monthOverMonthChange: 0,
      projectionVariance: 0,
      largestPositiveVariance: null,
      largestNegativeVariance: null,
    },
  }),
  saveMonthEndCloseDraft: async () => ({}),
  closeMonthEndClose: async () => ({}),
  reopenMonth: async () => ({}),
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

describe("MonthlyReviewPage", () => {
  it("renders projection comparison section", async () => {
    render(<MonthlyReviewPage />);

    expect(await screen.findByText("Projection Comparison")).toBeTruthy();
    expect(await screen.findByText(/Data required/)).toBeTruthy();
  });
});

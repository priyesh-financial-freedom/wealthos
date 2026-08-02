import { describe, expect, it } from "vitest";

import {
  MonthlyReviewComparisonService,
  type GetMonthlyReviewComparisonInput,
} from "./MonthlyReviewComparisonService";

type PlanKind = "FIXED" | "ROLLING";

type Source = {
  getClosedMonthEndByMonth: (params: { userId: string; reviewMonth: string; closeId?: string | null }) => Promise<{ id: string; user_id: string; close_month: number; close_year: number } | null>;
  getCloseItems: (closeId: string) => Promise<Array<{ item_key: string; actual_value: number | string | null }>>;
  getLatestLockedPlanForMonth: (params: { userId: string; reviewMonth: string; planKind: PlanKind }) => Promise<{ id: string } | null>;
  getMonthlyPositions: (params: { planVersionId: string; reviewMonth: string; bucketKeys: string[] }) => Promise<Array<{ bucket_key: any; closing_value: number | string | null }>>;
};

function buildInput(overrides?: Partial<GetMonthlyReviewComparisonInput>): GetMonthlyReviewComparisonInput {
  return {
    user_id: "user-1",
    review_month: "2026-08",
    close_id: "close-1",
    ...overrides,
  };
}

function buildSource(overrides?: Partial<Source>): Source {
  return {
    getClosedMonthEndByMonth: overrides?.getClosedMonthEndByMonth ?? (async () => ({ id: "close-1", user_id: "user-1", close_month: 8, close_year: 2026 })),
    getCloseItems: overrides?.getCloseItems ?? (async () => [
      { item_key: "bank_accounts", actual_value: 100 },
      { item_key: "mutual_funds", actual_value: 200 },
      { item_key: "stocks", actual_value: 300 },
      { item_key: "epf", actual_value: 400 },
      { item_key: "ppf", actual_value: 500 },
      { item_key: "nps", actual_value: 600 },
      { item_key: "real_estate", actual_value: 700 },
      { item_key: "gold", actual_value: 50 },
      { item_key: "silver", actual_value: 25 },
      { item_key: "other_assets", actual_value: 75 },
      { item_key: "home_loans", actual_value: 80 },
      { item_key: "car_loans", actual_value: 20 },
      { item_key: "other_liabilities", actual_value: 10 },
    ]),
    getLatestLockedPlanForMonth: overrides?.getLatestLockedPlanForMonth ?? (async ({ planKind }) => ({ id: `${planKind.toLowerCase()}-plan` })),
    getMonthlyPositions: overrides?.getMonthlyPositions ?? (async ({ planVersionId }) => {
      if (planVersionId === "fixed-plan") {
        return [
          { bucket_key: "cash", closing_value: 90 },
          { bucket_key: "mutual_funds", closing_value: 210 },
          { bucket_key: "stocks", closing_value: 310 },
          { bucket_key: "epf", closing_value: 390 },
          { bucket_key: "ppf", closing_value: 490 },
          { bucket_key: "nps", closing_value: 590 },
          { bucket_key: "financial_assets_total", closing_value: 2080 },
          { bucket_key: "non_financial_assets_total", closing_value: 860 },
          { bucket_key: "liabilities", closing_value: 95 },
          { bucket_key: "net_worth", closing_value: 2845 },
        ];
      }

      return [
        { bucket_key: "cash", closing_value: 95 },
        { bucket_key: "mutual_funds", closing_value: 205 },
        { bucket_key: "stocks", closing_value: 305 },
        { bucket_key: "epf", closing_value: 395 },
        { bucket_key: "ppf", closing_value: 495 },
        { bucket_key: "nps", closing_value: 595 },
        { bucket_key: "financial_assets_total", closing_value: 2090 },
        { bucket_key: "non_financial_assets_total", closing_value: 850 },
        { bucket_key: "liabilities", closing_value: 100 },
        { bucket_key: "net_worth", closing_value: 2840 },
      ];
    }),
  };
}

function findRow(result: Awaited<ReturnType<MonthlyReviewComparisonService["getMonthlyReviewComparison"]>>, lineKey: string) {
  const row = result.rows.find((entry) => entry.line_key === lineKey);
  if (!row) {
    throw new Error(`Missing row: ${lineKey}`);
  }

  return row;
}

describe("MonthlyReviewComparisonService", () => {
  it("calculates actual vs fixed variance", async () => {
    const service = new MonthlyReviewComparisonService(buildSource() as never);

    const result = await service.getMonthlyReviewComparison(buildInput());

    const cash = findRow(result, "cash");
    expect(cash.actual_value).toBe(100);
    expect(cash.fixed_value).toBe(90);
    expect(cash.variance_vs_fixed).toBe(10);
    expect(cash.variance_vs_fixed_percent).toBeCloseTo(11.11, 2);
  });

  it("calculates actual vs rolling variance", async () => {
    const service = new MonthlyReviewComparisonService(buildSource() as never);

    const result = await service.getMonthlyReviewComparison(buildInput());

    const liabilities = findRow(result, "liabilities");
    expect(liabilities.actual_value).toBe(110);
    expect(liabilities.rolling_value).toBe(100);
    expect(liabilities.variance_vs_rolling).toBe(10);
    expect(liabilities.variance_vs_rolling_percent).toBe(10);
  });

  it("handles missing fixed projection without crashing", async () => {
    const service = new MonthlyReviewComparisonService(buildSource({
      getLatestLockedPlanForMonth: async ({ planKind }) => (planKind === "FIXED" ? null : { id: "rolling-plan" }),
    }) as never);

    const result = await service.getMonthlyReviewComparison(buildInput());

    const cash = findRow(result, "cash");
    expect(result.fixed_plan_version_id).toBeNull();
    expect(cash.fixed_value).toBeNull();
    expect(cash.variance_vs_fixed).toBeNull();
    expect(cash.variance_vs_fixed_percent).toBeNull();
  });

  it("handles missing rolling projection without crashing", async () => {
    const service = new MonthlyReviewComparisonService(buildSource({
      getLatestLockedPlanForMonth: async ({ planKind }) => (planKind === "ROLLING" ? null : { id: "fixed-plan" }),
    }) as never);

    const result = await service.getMonthlyReviewComparison(buildInput());

    const cash = findRow(result, "cash");
    expect(result.rolling_plan_version_id).toBeNull();
    expect(cash.rolling_value).toBeNull();
    expect(cash.variance_vs_rolling).toBeNull();
    expect(cash.variance_vs_rolling_percent).toBeNull();
  });

  it("avoids division errors when projection is zero", async () => {
    const service = new MonthlyReviewComparisonService(buildSource({
      getMonthlyPositions: async ({ planVersionId }) => {
        if (planVersionId === "fixed-plan") {
          return [
            { bucket_key: "cash", closing_value: 0 },
            { bucket_key: "mutual_funds", closing_value: 210 },
            { bucket_key: "stocks", closing_value: 310 },
            { bucket_key: "epf", closing_value: 390 },
            { bucket_key: "ppf", closing_value: 490 },
            { bucket_key: "nps", closing_value: 590 },
            { bucket_key: "financial_assets_total", closing_value: 1980 },
            { bucket_key: "non_financial_assets_total", closing_value: 860 },
            { bucket_key: "liabilities", closing_value: 95 },
            { bucket_key: "net_worth", closing_value: 2745 },
          ];
        }

        return [
          { bucket_key: "cash", closing_value: 95 },
          { bucket_key: "mutual_funds", closing_value: 205 },
          { bucket_key: "stocks", closing_value: 305 },
          { bucket_key: "epf", closing_value: 395 },
          { bucket_key: "ppf", closing_value: 495 },
          { bucket_key: "nps", closing_value: 595 },
          { bucket_key: "financial_assets_total", closing_value: 2090 },
          { bucket_key: "non_financial_assets_total", closing_value: 850 },
          { bucket_key: "liabilities", closing_value: 100 },
          { bucket_key: "net_worth", closing_value: 2840 },
        ];
      },
    }) as never);

    const result = await service.getMonthlyReviewComparison(buildInput());

    const cash = findRow(result, "cash");
    expect(cash.fixed_value).toBe(0);
    expect(cash.variance_vs_fixed).toBe(100);
    expect(cash.variance_vs_fixed_percent).toBeNull();
  });

  it("returns all required comparison rows", async () => {
    const service = new MonthlyReviewComparisonService(buildSource() as never);

    const result = await service.getMonthlyReviewComparison(buildInput());

    expect(result.rows.map((row) => row.line_key)).toEqual([
      "cash",
      "mutual_funds",
      "stocks",
      "epf",
      "ppf",
      "nps",
      "financial_assets_total",
      "non_financial_assets_total",
      "liabilities",
      "net_worth",
    ]);
  });
});

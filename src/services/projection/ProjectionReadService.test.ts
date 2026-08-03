import { describe, expect, it } from "vitest";

import { groupMonthlyPositionRows, groupMonthlyPositionSnapshots } from "./ProjectionReadModel";

describe("groupMonthlyPositionRows", () => {
  it("groups bucket rows into month-wise table rows", () => {
    const rows = groupMonthlyPositionRows([
      { month_key: "2026-08", bucket_key: "cash", closing_value: 100000 },
      { month_key: "2026-08", bucket_key: "mutual_funds", closing_value: 250000 },
      { month_key: "2026-08", bucket_key: "net_worth", closing_value: 900000 },
      { month_key: "2026-09", bucket_key: "cash", closing_value: 110000 },
      { month_key: "2026-09", bucket_key: "net_worth", closing_value: 920000 },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.month).toBe("2026-08");
    expect(rows[0]?.cash).toBe(100000);
    expect(rows[0]?.mutual_funds).toBe(250000);
    expect(rows[0]?.net_worth).toBe(900000);
    expect(rows[1]?.month).toBe("2026-09");
    expect(rows[1]?.cash).toBe(110000);
    expect(rows[1]?.net_worth).toBe(920000);
  });

  it("keeps missing bucket values as null instead of zero", () => {
    const rows = groupMonthlyPositionRows([
      { month_key: "2026-08", bucket_key: "cash", closing_value: 100000 },
      { month_key: "2026-08", bucket_key: "net_worth", closing_value: 900000 },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.cash).toBe(100000);
    expect(rows[0]?.mutual_funds).toBeNull();
    expect(rows[0]?.stocks).toBeNull();
    expect(rows[0]?.epf).toBeNull();
    expect(rows[0]?.financial_assets_total).toBeNull();
  });

  it("builds month snapshots from closing values and cash metadata", () => {
    const snapshots = groupMonthlyPositionSnapshots([
      { month_key: "2026-08", bucket_key: "cash", closing_value: 100000, metadata: { salaryIncomeFromCommonCurve: 50000, expenseApplied: 30000 } },
      { month_key: "2026-08", bucket_key: "epf", closing_value: 200000 },
      { month_key: "2026-08", bucket_key: "ppf", closing_value: 150000 },
      { month_key: "2026-08", bucket_key: "nps", closing_value: 50000 },
      { month_key: "2026-08", bucket_key: "financial_assets_total", closing_value: 500000 },
      { month_key: "2026-08", bucket_key: "non_financial_assets_total", closing_value: 300000 },
      { month_key: "2026-08", bucket_key: "liabilities", closing_value: 120000 },
      { month_key: "2026-08", bucket_key: "net_worth", closing_value: 680000 },
    ]);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.month).toBe("2026-08");
    expect(snapshots[0]?.monthly_income).toBe(50000);
    expect(snapshots[0]?.monthly_expense).toBe(30000);
    expect(snapshots[0]?.retirement_corpus).toBe(400000);
    expect(snapshots[0]?.property_value).toBe(300000);
    expect(snapshots[0]?.total_debt).toBe(120000);
    expect(snapshots[0]?.corpus_drawdown).toBe(0);
  });
});

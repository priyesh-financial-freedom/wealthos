import { describe, expect, it } from "vitest";

import { groupMonthlyPositionRows } from "./ProjectionReadModel";

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
});

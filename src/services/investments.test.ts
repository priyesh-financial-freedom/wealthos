import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
  const user = { id: "user-1" };

  const holdingsRows = [
    {
      id: "inv-1",
      user_id: "user-1",
      owner: "Priyesh",
      institution: "Acme Labs",
      investment_name: "Acme Labs",
      investment_type: "Startup Investments",
      acquisition_date: "2026-03-15",
      purchase_date: "2026-03-15",
      cost_value: 500000,
      current_value: 3200000,
      units: 1,
      nav_price: 1,
      status: "active",
      notes: null,
      created_at: "2026-03-15T00:00:00.000Z",
      updated_at: "2026-03-15T00:00:00.000Z",
    },
  ];

  const from = vi.fn((table: string) => {
    if (table === "investment_holdings") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn(async () => ({ data: holdingsRows, error: null })),
      };
    }

    if (table === "investment_monthly_history") {
      let orderCalls = 0;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn(() => {
          orderCalls += 1;
          if (orderCalls === 1) {
            return {
              order: vi.fn(async () => ({ data: [], error: null })),
            };
          }
          return Promise.resolve({ data: [], error: null });
        }),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn(async () => ({ data: [], error: null })),
    };
  });

  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user }, error: null })),
      },
      from,
    },
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: runtime.supabase,
}));

import { getInvestments } from "./investments";

describe("investments service mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses explicit current_value for startup investments instead of units x nav fallback", async () => {
    const result = await getInvestments();

    expect(result).toHaveLength(1);
    expect(result[0].investment_type).toBe("Startup Investments");
    expect(result[0].current_value).toBe(3200000);
  });
});

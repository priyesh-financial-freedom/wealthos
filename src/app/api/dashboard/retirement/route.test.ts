import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

const mockCreateSupabaseServerClient = vi.fn();
const mockGetRetirementSummary = vi.fn();
const mockGetBalanceSheetData = vi.fn();
const mockGetAssumptionsBundle = vi.fn();
const mockGetLatestLockedRollingProjection = vi.fn();
const mockGetLatestLockedFixedProjection = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

vi.mock("@/services/retirement", () => ({
  getRetirementSummary: mockGetRetirementSummary,
}));

vi.mock("@/services/balanceSheet", () => ({
  getBalanceSheetData: mockGetBalanceSheetData,
}));

vi.mock("@/services/assumptions", () => ({
  DEFAULT_SCENARIO_KEY: "default",
  assumptionsService: {
    getAssumptionsBundle: mockGetAssumptionsBundle,
  },
}));

vi.mock("@/services/projection/ProjectionReadService", () => ({
  createProjectionReadServerService: () => ({
    getLatestLockedRollingProjection: mockGetLatestLockedRollingProjection,
    getLatestLockedFixedProjection: mockGetLatestLockedFixedProjection,
  }),
}));

describe("/api/dashboard/retirement route", () => {
  it("does not import browser supabase client in the server route", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/dashboard/retirement/route.ts"), "utf8");

    expect(source.includes("@/lib/supabase/client")).toBe(false);
  });

  it("returns 401 when authenticated user is missing", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const { GET } = await import("./route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.message).toBe("Authentication required.");
  });

  it("uses rolling corpus at retirement month and falls back to fixed when rolling is missing", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });

    mockGetRetirementSummary.mockResolvedValue({ totalRetirementAssets: 4000000 });
    mockGetBalanceSheetData.mockResolvedValue({ summary: { categoryTotals: { retirement: 4100000 } } });
    mockGetAssumptionsBundle.mockResolvedValue({
      retirement: { salaryStopMonth: 6, salaryStopYear: 2048 },
    });

    mockGetLatestLockedRollingProjection.mockResolvedValue({
      monthRows: [{ month: "2048-06", financial_assets_total: 9000000, net_worth: 11000000 }],
    });
    mockGetLatestLockedFixedProjection.mockResolvedValue({
      monthRows: [{ month: "2048-06", financial_assets_total: 8500000, net_worth: 10500000 }],
    });

    const { GET } = await import("./route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.expectedCorpusAtRetirement).toBe(9000000);
    expect(payload.retirementDate).toBe("Jun 2048");
    expect(payload.statusLabel).toBe("Needs Attention");

    mockGetLatestLockedRollingProjection.mockResolvedValueOnce({
      monthRows: [{ month: "2048-05", financial_assets_total: 9000000, net_worth: 11000000 }],
    });

    const fallbackResponse = await GET();
    const fallbackPayload = await fallbackResponse.json();

    expect(fallbackResponse.status).toBe(200);
    expect(fallbackPayload.expectedCorpusAtRetirement).toBe(8500000);
  });

  it("returns 200 with nullable expected corpus and status data required when projection month is missing", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });

    mockGetRetirementSummary.mockResolvedValue({ totalRetirementAssets: 4000000 });
    mockGetBalanceSheetData.mockResolvedValue({ summary: { categoryTotals: { retirement: 4100000 } } });
    mockGetAssumptionsBundle.mockResolvedValue({
      retirement: { salaryStopMonth: 6, salaryStopYear: 2048 },
    });
    mockGetLatestLockedRollingProjection.mockResolvedValue({
      monthRows: [{ month: "2048-05", financial_assets_total: 9000000, net_worth: 11000000 }],
    });
    mockGetLatestLockedFixedProjection.mockResolvedValue({
      monthRows: [{ month: "2048-04", financial_assets_total: 8500000, net_worth: 10500000 }],
    });

    const { GET } = await import("./route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.currentRetirementCorpus).toBe(4000000);
    expect(payload.expectedCorpusAtRetirement).toBeNull();
    expect(payload.retirementDate).toBe("Jun 2048");
    expect(payload.statusLabel).toBe("Data required");
  });

  it("falls back to balance sheet retirement total when retirement summary fails", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });

    mockGetRetirementSummary.mockRejectedValue(new Error("retirement service down"));
    mockGetBalanceSheetData.mockResolvedValue({ summary: { categoryTotals: { retirement: 3200000 } } });
    mockGetAssumptionsBundle.mockResolvedValue({
      retirement: { salaryStopMonth: 6, salaryStopYear: 2048 },
    });
    mockGetLatestLockedRollingProjection.mockResolvedValue(null);
    mockGetLatestLockedFixedProjection.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.currentRetirementCorpus).toBe(3200000);
    expect(payload.expectedCorpusAtRetirement).toBeNull();
    expect(payload.retirementDate).toBe("Jun 2048");
    expect(payload.statusLabel).toBe("Data required");
  });

  it("returns 200 with nullable current corpus when both retirement sources are unavailable", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });

    mockGetRetirementSummary.mockRejectedValue(new Error("retirement service down"));
    mockGetBalanceSheetData.mockRejectedValue(new Error("balance sheet down"));
    mockGetAssumptionsBundle.mockResolvedValue({
      retirement: { salaryStopMonth: 6, salaryStopYear: 2048 },
    });
    mockGetLatestLockedRollingProjection.mockResolvedValue(null);
    mockGetLatestLockedFixedProjection.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.currentRetirementCorpus).toBeNull();
    expect(payload.expectedCorpusAtRetirement).toBeNull();
    expect(payload.retirementDate).toBe("Jun 2048");
    expect(payload.statusLabel).toBe("Data required");
  });
});

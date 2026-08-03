import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mockGetDashboardCore = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();

vi.mock("@/services/dashboard", () => ({
  executiveDashboardService: {
    getDashboardCore: mockGetDashboardCore,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

describe("/api/dashboard/core route", () => {
  it("does not import browser supabase client in the server route", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/dashboard/core/route.ts"), "utf8");

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

  it("returns dashboard data for authenticated users", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });

    mockGetDashboardCore.mockResolvedValue({ emptyState: true });

    const { GET } = await import("./route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ emptyState: true });
  });
});

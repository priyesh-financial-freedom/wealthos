import { describe, expect, it, vi } from "vitest";

import type { ContributionPolicy } from "@/types/contributionPolicy";

import { EventGenerator } from "./EventGenerator";

function buildPolicy(overrides: Partial<ContributionPolicy> = {}): ContributionPolicy {
  return {
    id: "policy-1",
    userId: "user-1",
    policyGroupId: null,
    name: "Core SIP",
    description: null,
    targetAccount: "Mutual Fund",
    amount: 20000,
    currency: "INR",
    frequency: "MONTHLY",
    startDate: "2026-01-01",
    endDate: null,
    growthStrategy: "FIXED",
    growthRate: null,
    growthAmount: null,
    minLimitAmount: null,
    maxLimitAmount: null,
    cashProtectionEnabled: false,
    goalReference: null,
    formulaExpression: null,
    formulaVariables: null,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("EventGenerator", () => {
  it("generates seeds from active contribution policies", async () => {
    const listPolicies = vi.fn(async () => [buildPolicy(), buildPolicy({ id: "policy-2", status: "PAUSED" })]);
    const generator = new EventGenerator({
      contributionRepository: { listPolicies } as never,
      now: () => new Date("2026-07-01T00:00:00.000Z"),
    });

    const seeds = await generator.generate({ dateFrom: "2026-07-01T00:00:00.000Z", dateTo: "2026-08-31T23:59:59.999Z" });

    const sipSeeds = seeds.filter((seed) => seed.eventType === "SIP");
    expect(sipSeeds).toHaveLength(1);
    expect(sipSeeds[0].sourceType).toBe("CONTRIBUTION_POLICY");
    expect(sipSeeds[0].frequency).toBe("MONTHLY");
  });

  it("includes system snapshot seeds", async () => {
    const generator = new EventGenerator({
      contributionRepository: { listPolicies: vi.fn(async () => []) } as never,
      now: () => new Date("2026-07-01T00:00:00.000Z"),
    });

    const seeds = await generator.generate();
    expect(seeds.some((seed) => seed.eventType === "SNAPSHOT" && seed.sourceType === "SYSTEM")).toBe(true);
  });
});

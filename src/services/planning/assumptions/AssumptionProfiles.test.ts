import { describe, expect, it } from "vitest";

import {
  createHouseholdAssumptionProfile,
  createPlanningEntityAssumptionProfile,
  createPlanningEntitySleeveProfile,
} from "./AssumptionProfiles";
import { SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS } from "./AssumptionDefaults";
import { ASSUMPTION_REGISTRY } from "./AssumptionRegistry";

describe("AssumptionProfiles", () => {
  it("creates a household profile with cloned assumptions and household ownership", () => {
    const assumptions = {
      currentAge: 36,
      retirementAge: 61,
      salaryGrowthRate: 9,
    };

    const profile = createHouseholdAssumptionProfile({
      assumptions,
      label: "Household",
    });

    expect(profile.id).toBe("planning-assumption-profile:household");
    expect(profile.label).toBe("Household");
    expect(profile.owner).toEqual({ scope: "HOUSEHOLD" });
    expect(profile.assumptions).toEqual(assumptions);
    expect(profile.assumptions).not.toBe(assumptions);
  });

  it("creates an entity profile with entity-type ownership metadata", () => {
    const profile = createPlanningEntityAssumptionProfile({
      entityKey: "home-loan",
      assumptions: {
        homeLoanInterest: 8.25,
        loanPrepaymentStrategy: "HYBRID",
      },
    });

    expect(profile.id).toBe("planning-assumption-profile:entity:home-loan");
    expect(profile.owner).toEqual({ scope: "ENTITY_TYPE", entityKey: "home-loan" });
    expect(profile.assumptions).toEqual({
      homeLoanInterest: 8.25,
      loanPrepaymentStrategy: "HYBRID",
    });
  });

  it("creates an NPS sleeve profile with sleeve ownership metadata", () => {
    const profile = createPlanningEntitySleeveProfile({
      sleeveKey: "equity",
      assumptions: {
        npsEquityReturn: 11,
        npsDebtReturn: 7,
      },
    });

    expect(profile.id).toBe("planning-assumption-profile:sleeve:nps:equity");
    expect(profile.owner).toEqual({ scope: "SLEEVE", entityKey: "nps", sleeveKey: "equity", entityInstanceId: null });
    expect(profile.assumptions).toEqual({
      npsEquityReturn: 11,
      npsDebtReturn: 7,
    });
  });

  it("attaches planning-owned metadata to every registry entry", () => {
    expect(ASSUMPTION_REGISTRY).toHaveLength(Object.keys(SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS).length);
    expect(ASSUMPTION_REGISTRY.every((item) => item.owner && typeof item.owner.scope === "string")).toBe(true);
    expect(ASSUMPTION_REGISTRY.find((item) => item.key === "currentAge")?.owner).toEqual({ scope: "HOUSEHOLD" });
    expect(ASSUMPTION_REGISTRY.find((item) => item.key === "equityReturn")?.owner).toEqual({ scope: "ENTITY_TYPE", entityKey: "mutual-funds" });
    expect(ASSUMPTION_REGISTRY.find((item) => item.key === "npsEquityReturn")?.owner).toEqual({ scope: "SLEEVE", entityKey: "nps", sleeveKey: "equity", entityInstanceId: null });
    expect(ASSUMPTION_REGISTRY.find((item) => item.key === "homeLoanInterest")?.owner).toEqual({ scope: "ENTITY_TYPE", entityKey: "home-loan" });
    expect(ASSUMPTION_REGISTRY.find((item) => item.key === "loanPrepaymentStrategy")?.owner).toEqual({ scope: "HOUSEHOLD" });
  });
});

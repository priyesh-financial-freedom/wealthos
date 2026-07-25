import { describe, expect, it } from "vitest";

import { SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS } from "./AssumptionDefaults";
import { createHouseholdAssumptionProfile, createPlanningEntityAssumptionProfile } from "./AssumptionProfiles";
import { AssumptionProvider } from "./AssumptionProvider";

describe("AssumptionProvider", () => {
  it("exposes resolved profiles and the legacy bundle", () => {
    const provider = new AssumptionProvider();

    const result = provider.resolve({
      householdProfile: createHouseholdAssumptionProfile({
        assumptions: {
          currentAge: 38,
          retirementAge: 60,
          salaryGrowthRate: 7,
        },
      }),
      entityTypeProfile: createPlanningEntityAssumptionProfile({
        entityKey: "mutual-funds",
        assumptions: {
          equityReturn: 13,
        },
      }),
      entityInstanceProfile: createPlanningEntityAssumptionProfile({
        entityKey: "mutual-funds",
        entityInstanceId: "mf-1",
        assumptions: {
          equityReturn: 14,
        },
      }),
    });

    expect(result.resolvedProfile.values.currentAge).toBe(38);
    expect(result.resolvedProfile.fields.equityReturn.provenance.sourceScope).toBe("ENTITY_INSTANCE");
    expect(result.legacyBundle.investments.expectedReturnRate).toBe(14);
    expect(result.legacyBundle.income.salaryGrowthRate).toBe(7);
  });

  it("preserves backward compatibility through loadAssumptions", () => {
    const provider = new AssumptionProvider();

    const bundle = provider.loadAssumptions({
      householdProfile: createHouseholdAssumptionProfile({
        assumptions: {
          currentAge: 40,
          salaryGrowthRate: 8,
        },
      }),
    });

    expect(bundle.income.salaryGrowthRate).toBe(8);
    expect(bundle.investments.expectedReturnRate).toBe(SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.equityReturn);
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(Object.isFrozen(bundle.investments)).toBe(true);
  });

  it("returns frozen resolved profiles", () => {
    const provider = new AssumptionProvider();

    const result = provider.resolve({
      householdProfile: createHouseholdAssumptionProfile({
        assumptions: {
          currentAge: 35,
        },
      }),
    });

    expect(Object.isFrozen(result.resolvedProfile)).toBe(true);
    expect(Object.isFrozen(result.resolvedProfile.values)).toBe(true);
    expect(Object.isFrozen(result.resolvedProfile.fields)).toBe(true);
    expect(Object.isFrozen(result.legacyBundle)).toBe(true);
  });
});

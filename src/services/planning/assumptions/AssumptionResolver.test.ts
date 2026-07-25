import { describe, expect, it } from "vitest";

import { SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS } from "./AssumptionDefaults";
import { createHouseholdAssumptionProfile, createPlanningEntityAssumptionProfile } from "./AssumptionProfiles";
import { AssumptionResolver } from "./AssumptionResolver";

describe("AssumptionResolver", () => {
  it("resolves values in entity instance, entity type, household, then system default order", () => {
    const resolver = new AssumptionResolver();

    const entityInstanceProfile = createPlanningEntityAssumptionProfile({
      entityKey: "home-loan",
      entityInstanceId: "home-loan-1",
      assumptions: {
        salaryGrowthRate: 12,
        homeLoanInterest: 9.1,
      },
    });

    const entityTypeProfile = createPlanningEntityAssumptionProfile({
      entityKey: "home-loan",
      assumptions: {
        salaryGrowthRate: 7,
        homeLoanInterest: 8.4,
      },
    });

    const householdProfile = createHouseholdAssumptionProfile({
      assumptions: {
        currentAge: 41,
        salaryGrowthRate: 6,
        retirementAge: 60,
      },
    });

    const resolved = resolver.resolve({
      entityInstanceProfile,
      entityTypeProfile,
      householdProfile,
    });

    expect(resolved.values.salaryGrowthRate).toBe(12);
    expect(resolved.fields.salaryGrowthRate.provenance.sourceScope).toBe("ENTITY_INSTANCE");
    expect(resolved.values.homeLoanInterest).toBe(9.1);
    expect(resolved.fields.homeLoanInterest.provenance.sourceScope).toBe("ENTITY_INSTANCE");
    expect(resolved.values.retirementAge).toBe(60);
    expect(resolved.fields.retirementAge.provenance.sourceScope).toBe("HOUSEHOLD");
    expect(resolved.values.currentAge).toBe(41);
    expect(resolved.fields.currentAge.provenance.sourceScope).toBe("HOUSEHOLD");
  });

  it("falls back to lower scopes and system defaults when assumptions are missing", () => {
    const resolver = new AssumptionResolver();

    const entityInstanceProfile = createPlanningEntityAssumptionProfile({
      entityKey: "personal-loan",
      entityInstanceId: "loan-1",
      assumptions: {
        personalLoanInterest: 15,
      },
    });

    const householdProfile = createHouseholdAssumptionProfile({
      assumptions: {
        currentAge: 39,
      },
    });

    const resolved = resolver.resolve({
      entityInstanceProfile,
      householdProfile,
    });

    expect(resolved.values.personalLoanInterest).toBe(15);
    expect(resolved.fields.personalLoanInterest.provenance.sourceScope).toBe("ENTITY_INSTANCE");
    expect(resolved.values.currentAge).toBe(39);
    expect(resolved.fields.currentAge.provenance.sourceScope).toBe("HOUSEHOLD");
    expect(resolved.values.equityReturn).toBe(SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.equityReturn);
    expect(resolved.fields.equityReturn.provenance.sourceScope).toBe("SYSTEM_DEFAULT");
    expect(resolved.values.loanPrepaymentStrategy).toBe(SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.loanPrepaymentStrategy);
    expect(resolved.fields.loanPrepaymentStrategy.provenance.sourceScope).toBe("SYSTEM_DEFAULT");
  });

  it("returns system defaults when no profiles are provided", () => {
    const resolver = new AssumptionResolver();

    const resolved = resolver.resolve();

    expect(resolved.values).toEqual(SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS);
    expect(resolved.fields.currentAge.provenance.sourceScope).toBe("SYSTEM_DEFAULT");
    expect(resolved.fields.currentAge.provenance.inheritanceLevel).toBe(1);
  });

  it("returns immutable snapshots", () => {
    const resolver = new AssumptionResolver();
    const householdProfile = createHouseholdAssumptionProfile({
      assumptions: {
        currentAge: 40,
        retirementAge: 60,
      },
    });

    const resolved = resolver.resolve({ householdProfile });

    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.values)).toBe(true);
    expect(Object.isFrozen(resolved.fields)).toBe(true);
    expect(Object.isFrozen(resolved.fields.currentAge)).toBe(true);
    expect(Object.isFrozen(resolved.fields.currentAge.provenance)).toBe(true);

    householdProfile.assumptions.currentAge = 99;

    expect(resolved.values.currentAge).toBe(40);
  });
});

import type { AssumptionsBundle } from "@/types/assumptions";

import { mapLegacyBundle } from "./AssumptionService";
import {
  assumptionResolver,
  type AssumptionResolver,
  type ResolvedAssumptionProfile,
} from "./AssumptionResolver";
import type {
  EffectivePlanningAssumptions,
  HouseholdAssumptionProfile,
  PlanningEntityAssumptionProfile,
  PlanningEntitySleeveProfile,
} from "./AssumptionTypes";

export interface AssumptionProviderInput {
  entityInstanceProfile?: PlanningEntityAssumptionProfile | null;
  entityTypeProfile?: PlanningEntityAssumptionProfile | null;
  householdProfile?: HouseholdAssumptionProfile | null;
  sleeveProfile?: PlanningEntitySleeveProfile | null;
  systemDefaults?: EffectivePlanningAssumptions;
}

export interface AssumptionProviderResult {
  resolvedProfile: Readonly<ResolvedAssumptionProfile>;
  legacyBundle: Readonly<AssumptionsBundle>;
}

function freezeBundle(bundle: AssumptionsBundle): Readonly<AssumptionsBundle> {
  return Object.freeze({
    income: Object.freeze({ ...bundle.income }),
    investments: Object.freeze({ ...bundle.investments }),
    inflation: Object.freeze({ ...bundle.inflation }),
    loans: Object.freeze({ ...bundle.loans }),
    retirement: Object.freeze({ ...bundle.retirement }),
    tax: Object.freeze({ ...bundle.tax }),
    planning: Object.freeze({ ...bundle.planning }),
  });
}

export class AssumptionProvider {
  constructor(private readonly resolver: AssumptionResolver = assumptionResolver) {}

  resolve(input: AssumptionProviderInput = {}): AssumptionProviderResult {
    const resolvedProfile = this.resolver.resolve(input);

    return {
      resolvedProfile,
      legacyBundle: freezeBundle(mapLegacyBundle(resolvedProfile.values)),
    };
  }

  getResolvedProfile(input: AssumptionProviderInput = {}): Readonly<ResolvedAssumptionProfile> {
    return this.resolve(input).resolvedProfile;
  }

  loadAssumptions(input: AssumptionProviderInput = {}): Readonly<AssumptionsBundle> {
    return this.resolve(input).legacyBundle;
  }
}

export const assumptionProvider = new AssumptionProvider();

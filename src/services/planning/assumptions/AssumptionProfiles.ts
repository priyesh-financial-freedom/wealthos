import type {
  HouseholdAssumptionKey,
  HouseholdAssumptionProfile,
  HouseholdAssumptionValues,
  PlanningAssumptionOwnerMetadata,
  PlanningAssumptionOwnerScope,
  PlanningAssumptionProfile,
  PlanningEntityAssumptionKey,
  PlanningEntityAssumptionProfile,
  PlanningEntityAssumptionValues,
  PlanningEntityKey,
  PlanningEntitySleeveAssumptionKey,
  PlanningEntitySleeveAssumptionValues,
  PlanningEntitySleeveKey,
  PlanningEntitySleeveProfile,
} from "./AssumptionTypes";

function cloneAssumptions<TAssumptions extends Record<string, unknown>>(assumptions: TAssumptions): TAssumptions {
  return { ...assumptions };
}

function buildProfileId(owner: PlanningAssumptionOwnerMetadata) {
  if (owner.scope === "HOUSEHOLD") {
    return "planning-assumption-profile:household";
  }

  if (owner.scope === "ENTITY_TYPE") {
    return `planning-assumption-profile:entity:${owner.entityKey}`;
  }

  if (owner.scope === "ENTITY_INSTANCE") {
    const instanceId = owner.entityInstanceId ?? "default";
    return `planning-assumption-profile:entity:${owner.entityKey}:${instanceId}`;
  }

  return `planning-assumption-profile:sleeve:${owner.entityKey}:${owner.sleeveKey}`;
}

export function createHouseholdAssumptionOwner(): { scope: "HOUSEHOLD" } {
  return { scope: "HOUSEHOLD" };
}

export function createPlanningEntityAssumptionOwner(
  entityKey: PlanningEntityKey,
  entityInstanceId: string | null = null,
): PlanningAssumptionOwnerMetadata & { scope: "ENTITY_TYPE" | "ENTITY_INSTANCE" } {
  if (entityInstanceId) {
    return {
      scope: "ENTITY_INSTANCE",
      entityKey,
      entityInstanceId,
    };
  }

  return {
    scope: "ENTITY_TYPE",
    entityKey,
  };
}

export function createPlanningEntitySleeveOwner(
  entityKey: "nps",
  sleeveKey: PlanningEntitySleeveKey,
  entityInstanceId: string | null = null,
): PlanningAssumptionOwnerMetadata & { scope: "SLEEVE"; entityKey: "nps"; sleeveKey: PlanningEntitySleeveKey } {
  return {
    scope: "SLEEVE",
    entityKey,
    sleeveKey,
    entityInstanceId,
  };
}

export function createPlanningAssumptionProfile<TOwner extends PlanningAssumptionOwnerMetadata, TAssumptions extends Record<string, unknown>>(params: {
  owner: TOwner;
  assumptions: TAssumptions;
  label: string;
  notes?: string | null;
  id?: string;
}): PlanningAssumptionProfile<TAssumptions> & { owner: TOwner } {
  return {
    id: params.id ?? buildProfileId(params.owner),
    label: params.label,
    owner: params.owner,
    assumptions: cloneAssumptions(params.assumptions),
    notes: params.notes ?? null,
  };
}

export function createHouseholdAssumptionProfile(params: {
  label?: string;
  assumptions?: Partial<HouseholdAssumptionValues>;
  notes?: string | null;
  id?: string;
} = {}): HouseholdAssumptionProfile {
  return createPlanningAssumptionProfile({
    id: params.id,
    label: params.label ?? "Household Assumption Profile",
    owner: createHouseholdAssumptionOwner(),
    assumptions: cloneAssumptions(params.assumptions ?? {}),
    notes: params.notes,
  });
}

export function createPlanningEntityAssumptionProfile(params: {
  entityKey: PlanningEntityKey;
  entityInstanceId?: string | null;
  label?: string;
  assumptions?: PlanningEntityAssumptionValues;
  notes?: string | null;
  id?: string;
}): PlanningEntityAssumptionProfile {
  return createPlanningAssumptionProfile({
    id: params.id,
    label: params.label ?? `${params.entityKey} Assumption Profile`,
    owner: createPlanningEntityAssumptionOwner(params.entityKey, params.entityInstanceId ?? null),
    assumptions: cloneAssumptions(params.assumptions ?? {}),
    notes: params.notes,
  });
}

export function createPlanningEntitySleeveProfile(params: {
  sleeveKey: PlanningEntitySleeveKey;
  entityInstanceId?: string | null;
  label?: string;
  assumptions?: PlanningEntitySleeveAssumptionValues;
  notes?: string | null;
  id?: string;
}): PlanningEntitySleeveProfile {
  return createPlanningAssumptionProfile({
    id: params.id,
    label: params.label ?? `NPS ${params.sleeveKey} Sleeve Profile`,
    owner: createPlanningEntitySleeveOwner("nps", params.sleeveKey, params.entityInstanceId ?? null),
    assumptions: cloneAssumptions(params.assumptions ?? { npsEquityReturn: 0, npsDebtReturn: 0 }),
    notes: params.notes,
  });
}

export function clonePlanningAssumptionProfile<TAssumptions extends Record<string, unknown>>(
  profile: PlanningAssumptionProfile<TAssumptions>,
): PlanningAssumptionProfile<TAssumptions> {
  return {
    id: profile.id,
    label: profile.label,
    owner: { ...profile.owner },
    assumptions: cloneAssumptions(profile.assumptions),
    notes: profile.notes ?? null,
  };
}

export type {
  HouseholdAssumptionKey,
  HouseholdAssumptionProfile,
  HouseholdAssumptionValues,
  PlanningAssumptionOwnerMetadata,
  PlanningAssumptionOwnerScope,
  PlanningAssumptionProfile,
  PlanningEntityAssumptionKey,
  PlanningEntityAssumptionProfile,
  PlanningEntityAssumptionValues,
  PlanningEntityKey,
  PlanningEntitySleeveAssumptionKey,
  PlanningEntitySleeveAssumptionValues,
  PlanningEntitySleeveKey,
  PlanningEntitySleeveProfile,
} from "./AssumptionTypes";
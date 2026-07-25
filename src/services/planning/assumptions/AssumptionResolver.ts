import { SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS } from "./AssumptionDefaults";
import { getRegistryItem } from "./AssumptionRegistry";
import type {
  EffectivePlanningAssumptions,
  HouseholdAssumptionProfile,
  PlanningAssumptionCategoryKey,
  PlanningAssumptionDependency,
  PlanningAssumptionEngineId,
  PlanningAssumptionHelpContent,
  PlanningAssumptionKey,
  PlanningAssumptionOwnerMetadata,
  PlanningAssumptionProfile,
  PlanningAssumptionUnit,
  PlanningAssumptionInheritanceLevel,
  PlanningEntityAssumptionProfile,
  PlanningEntitySleeveProfile,
} from "./AssumptionTypes";

const RESOLVED_ASSUMPTION_KEYS = ["currentAge", ...(Object.keys(SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS) as PlanningAssumptionKey[])] as const satisfies readonly (keyof EffectivePlanningAssumptions)[];

export type ResolvedAssumptionSourceScope = "ENTITY_INSTANCE" | "ENTITY_TYPE" | "HOUSEHOLD" | "SYSTEM_DEFAULT";
export type ResolvedAssumptionSourceType = "PROFILE" | "SYSTEM_DEFAULT";

export interface ResolvedAssumptionProvenance<Key extends keyof EffectivePlanningAssumptions = keyof EffectivePlanningAssumptions> {
  key: Key;
  sourceScope: ResolvedAssumptionSourceScope;
  sourceType: ResolvedAssumptionSourceType;
  inheritanceLevel: PlanningAssumptionInheritanceLevel;
  overridden: boolean;
  profileId: string | null;
  profileLabel: string | null;
  owner: PlanningAssumptionOwnerMetadata | null;
  category: PlanningAssumptionCategoryKey;
  unit: PlanningAssumptionUnit;
  dependencies: readonly PlanningAssumptionDependency[];
  affectedEngines: readonly PlanningAssumptionEngineId[];
}

export type ResolvedAssumptionFieldMap = {
  [Key in keyof EffectivePlanningAssumptions]: {
    value: EffectivePlanningAssumptions[Key];
    provenance: Readonly<ResolvedAssumptionProvenance<Key>>;
  };
};

export interface ResolvedAssumptionProfile {
  values: Readonly<EffectivePlanningAssumptions>;
  fields: Readonly<ResolvedAssumptionFieldMap>;
  sourceProfiles: Readonly<{
    entityInstance: ResolvedSourceProfile;
    entityType: ResolvedSourceProfile;
    household: ResolvedSourceProfile;
    sleeve: ResolvedSourceProfile;
  }>;
}

type ResolvedSourceProfile = PlanningAssumptionProfile<Partial<EffectivePlanningAssumptions>> | null;

function cloneAssumptions<TAssumptions extends Record<string, unknown>>(assumptions: TAssumptions): TAssumptions {
  return { ...assumptions };
}

function freezeProfile<TAssumptions extends Record<string, unknown>>(profile: PlanningAssumptionProfile<TAssumptions> | null): PlanningAssumptionProfile<TAssumptions> | null {
  if (!profile) {
    return null;
  }

  return Object.freeze({
    ...profile,
    owner: Object.freeze({ ...profile.owner }),
    assumptions: Object.freeze(cloneAssumptions(profile.assumptions)),
  });
}

function freezeResolvedField<Key extends keyof EffectivePlanningAssumptions>(field: {
  value: EffectivePlanningAssumptions[Key];
  provenance: ResolvedAssumptionProvenance<Key>;
}) {
  return Object.freeze({
    value: field.value,
    provenance: Object.freeze({ ...field.provenance }),
  }) as Readonly<{
    value: EffectivePlanningAssumptions[Key];
    provenance: Readonly<ResolvedAssumptionProvenance<Key>>;
  }>;
}

function hasAssumptionValue<Key extends keyof EffectivePlanningAssumptions>(profile: ResolvedSourceProfile, key: Key) {
  if (!profile) {
    return false;
  }

  return typeof profile.assumptions[key] !== "undefined";
}

function resolveFromProfile<Key extends keyof EffectivePlanningAssumptions>(profile: ResolvedSourceProfile, key: Key) {
  if (!profile || typeof profile.assumptions[key] === "undefined") {
    return null;
  }

  return profile.assumptions[key] as EffectivePlanningAssumptions[Key];
}

function resolveField<Key extends keyof EffectivePlanningAssumptions>(params: {
  key: Key;
  entityInstanceProfile: ResolvedSourceProfile;
  entityTypeProfile: ResolvedSourceProfile;
  householdProfile: ResolvedSourceProfile;
  systemDefaults: EffectivePlanningAssumptions;
}): {
  value: EffectivePlanningAssumptions[Key];
  provenance: ResolvedAssumptionProvenance<Key>;
} {
  const registryItem = getRegistryItem(params.key);

  const candidates: Array<{
    scope: ResolvedAssumptionSourceScope;
    profile: ResolvedSourceProfile;
    inheritanceLevel: PlanningAssumptionInheritanceLevel;
  }> = [
    { scope: "ENTITY_INSTANCE", profile: params.entityInstanceProfile, inheritanceLevel: 4 },
    { scope: "ENTITY_TYPE", profile: params.entityTypeProfile, inheritanceLevel: 3 },
    { scope: "HOUSEHOLD", profile: params.householdProfile, inheritanceLevel: 2 },
  ];

  for (const candidate of candidates) {
    if (!hasAssumptionValue(candidate.profile, params.key)) {
      continue;
    }

    return {
      value: resolveFromProfile(candidate.profile, params.key) as EffectivePlanningAssumptions[Key],
      provenance: {
        key: params.key,
        sourceScope: candidate.scope,
        sourceType: "PROFILE",
        inheritanceLevel: candidate.inheritanceLevel,
        overridden: true,
        profileId: candidate.profile?.id ?? null,
        profileLabel: candidate.profile?.label ?? null,
        owner: candidate.profile?.owner ?? null,
        category: registryItem.category,
        unit: registryItem.unit,
        dependencies: registryItem.dependencies,
        affectedEngines: registryItem.affectedEngines,
      },
    };
  }

  return {
    value: params.systemDefaults[params.key],
    provenance: {
      key: params.key,
      sourceScope: "SYSTEM_DEFAULT",
      sourceType: "SYSTEM_DEFAULT",
      inheritanceLevel: 1,
      overridden: false,
      profileId: null,
      profileLabel: null,
      owner: null,
      category: registryItem.category,
      unit: registryItem.unit,
      dependencies: registryItem.dependencies,
      affectedEngines: registryItem.affectedEngines,
    },
  };
}

function assignResolvedValue<Key extends keyof EffectivePlanningAssumptions>(
  values: EffectivePlanningAssumptions,
  key: Key,
  value: EffectivePlanningAssumptions[Key],
) {
  values[key] = value;
}

function assignResolvedField<Key extends keyof EffectivePlanningAssumptions>(
  fields: ResolvedAssumptionFieldMap,
  key: Key,
  field: {
    value: EffectivePlanningAssumptions[Key];
    provenance: ResolvedAssumptionProvenance<Key>;
  },
) {
  fields[key] = freezeResolvedField(field) as ResolvedAssumptionFieldMap[Key];
}

function freezeResolvedAssumptionProfile(profile: ResolvedAssumptionProfile): Readonly<ResolvedAssumptionProfile> {
  const values = Object.freeze({ ...profile.values });
  const fields = Object.freeze(
    Object.fromEntries(
      Object.entries(profile.fields).map(([key, field]) => [key, freezeResolvedField(field as { value: EffectivePlanningAssumptions[keyof EffectivePlanningAssumptions]; provenance: ResolvedAssumptionProvenance } )]),
    ) as ResolvedAssumptionFieldMap,
  );

  return Object.freeze({
    values,
    fields,
    sourceProfiles: Object.freeze({ ...profile.sourceProfiles }),
  });
}

export class AssumptionResolver {
  resolve(params: {
    entityInstanceProfile?: PlanningEntityAssumptionProfile | null;
    entityTypeProfile?: PlanningEntityAssumptionProfile | null;
    householdProfile?: HouseholdAssumptionProfile | null;
    sleeveProfile?: PlanningEntitySleeveProfile | null;
    systemDefaults?: EffectivePlanningAssumptions;
  } = {}): Readonly<ResolvedAssumptionProfile> {
    const systemDefaults = params.systemDefaults ?? SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS;
    const entityInstanceProfile = freezeProfile(params.entityInstanceProfile ?? null);
    const entityTypeProfile = freezeProfile(params.entityTypeProfile ?? null);
    const householdProfile = freezeProfile(params.householdProfile ?? null);
    const sleeveProfile = freezeProfile(params.sleeveProfile ?? null);

    const values = {} as EffectivePlanningAssumptions;
    const fields = {} as ResolvedAssumptionFieldMap;

    for (const key of RESOLVED_ASSUMPTION_KEYS) {
      const resolvedField = resolveField({
        key,
        entityInstanceProfile,
        entityTypeProfile,
        householdProfile,
        systemDefaults,
      });

      assignResolvedValue(values, key, resolvedField.value);
      assignResolvedField(fields, key, resolvedField);
    }

    return freezeResolvedAssumptionProfile({
      values,
      fields,
      sourceProfiles: {
        entityInstance: entityInstanceProfile,
        entityType: entityTypeProfile,
        household: householdProfile,
        sleeve: sleeveProfile,
      },
    });
  }
}

export const assumptionResolver = new AssumptionResolver();

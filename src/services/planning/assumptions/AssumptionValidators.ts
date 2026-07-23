import { PLANNING_ASSUMPTION_FIELD_DEFINITIONS } from "./AssumptionDefaults";
import type {
  EffectivePlanningAssumptions,
  PlanningAssumptionKey,
  PlanningAssumptionOverrides,
} from "./AssumptionTypes";

function getFieldDefinition(key: PlanningAssumptionKey) {
  return PLANNING_ASSUMPTION_FIELD_DEFINITIONS.find((definition) => definition.key === key) ?? null;
}

export function validatePlanningAssumptionValue<Key extends PlanningAssumptionKey>(
  key: Key,
  value: EffectivePlanningAssumptions[Key],
): string | null {
  const definition = getFieldDefinition(key);
  if (!definition) {
    return null;
  }

  if (definition.inputKind === "select") {
    const options = definition.options ?? [];
    const isValidOption = options.some((option) => option.value === value);
    return isValidOption ? null : `${definition.label} must be one of the supported options.`;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${definition.label} must be a valid number.`;
  }

  if (definition.inputKind === "integer" && !Number.isInteger(value)) {
    return `${definition.label} must be a whole number.`;
  }

  if (typeof definition.min === "number" && value < definition.min) {
    return `${definition.label} must be at least ${definition.min}.`;
  }

  if (typeof definition.max === "number" && value > definition.max) {
    return `${definition.label} must be at most ${definition.max}.`;
  }

  return null;
}

export function validatePlanningAssumptionPatch(patch: PlanningAssumptionOverrides) {
  const issues: Partial<Record<PlanningAssumptionKey, string>> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === "undefined") {
      continue;
    }

    const issue = validatePlanningAssumptionValue(key as PlanningAssumptionKey, value as EffectivePlanningAssumptions[PlanningAssumptionKey]);
    if (issue) {
      issues[key as PlanningAssumptionKey] = issue;
    }
  }

  return issues;
}
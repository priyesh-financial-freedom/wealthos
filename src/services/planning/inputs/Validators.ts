import type {
  PlanningInputEntityMap,
  PlanningInputEntityName,
  PlanningInputVersionedEntity,
} from "./Types";

export interface PlanningInputValidationIssue {
  field: string;
  message: string;
}

function isValidDateToken(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function validateBaseFields(entity: PlanningInputVersionedEntity): PlanningInputValidationIssue[] {
  const issues: PlanningInputValidationIssue[] = [];

  if (!entity.id.trim()) {
    issues.push({ field: "id", message: "id is required." });
  }

  if (!isValidDateToken(entity.effectiveDate)) {
    issues.push({ field: "effectiveDate", message: "effectiveDate must be a valid ISO date string." });
  }

  if (!isPositiveInteger(entity.version)) {
    issues.push({ field: "version", message: "version must be a positive integer." });
  }

  if (!isValidDateToken(entity.createdAt)) {
    issues.push({ field: "createdAt", message: "createdAt must be a valid ISO datetime string." });
  }

  if (!isValidDateToken(entity.updatedAt)) {
    issues.push({ field: "updatedAt", message: "updatedAt must be a valid ISO datetime string." });
  }

  if (typeof entity.isActive !== "boolean") {
    issues.push({ field: "isActive", message: "isActive must be a boolean." });
  }

  if (entity.futureEffectiveDate !== null && !isValidDateToken(entity.futureEffectiveDate)) {
    issues.push({ field: "futureEffectiveDate", message: "futureEffectiveDate must be null or a valid ISO date string." });
  }

  if (entity.futureEffectiveDate !== null && entity.futureEffectiveDate < entity.effectiveDate) {
    issues.push({
      field: "futureEffectiveDate",
      message: "futureEffectiveDate cannot be earlier than effectiveDate.",
    });
  }

  return issues;
}

export class PlanningInputValidator {
  validate<TEntityName extends PlanningInputEntityName>(
    _entityName: TEntityName,
    entity: PlanningInputEntityMap[TEntityName],
  ): PlanningInputValidationIssue[] {
    return validateBaseFields(entity);
  }
}

export const planningInputValidator = new PlanningInputValidator();

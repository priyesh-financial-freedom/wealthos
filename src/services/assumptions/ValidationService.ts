import { AssumptionDataType } from "@/types/assumptions";
import type { Assumption, ProfileValidationResult, ValidationIssue } from "@/types/assumptions";

function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export class ValidationService {
  validateAssumption(assumption: Assumption, value: unknown): string[] {
    const issues: string[] = [];

    if (assumption.required && (isNil(value) || value === "")) {
      issues.push(`${assumption.name} is required.`);
      return issues;
    }

    if (isNil(value)) {
      return issues;
    }

    switch (assumption.dataType) {
      case AssumptionDataType.Number:
      case AssumptionDataType.Percentage:
      case AssumptionDataType.Currency:
        if (!isNumber(value)) {
          issues.push(`${assumption.name} must be a number.`);
          break;
        }
        this.validateRange(assumption, value, issues);
        break;
      case AssumptionDataType.Integer:
        if (!isNumber(value) || !Number.isInteger(value)) {
          issues.push(`${assumption.name} must be an integer.`);
          break;
        }
        this.validateRange(assumption, value, issues);
        break;
      case AssumptionDataType.Boolean:
        if (typeof value !== "boolean") {
          issues.push(`${assumption.name} must be true or false.`);
        }
        break;
      case AssumptionDataType.Text:
        if (typeof value !== "string") {
          issues.push(`${assumption.name} must be text.`);
        }
        break;
      case AssumptionDataType.Month:
        if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
          issues.push(`${assumption.name} must be in YYYY-MM format.`);
        }
        break;
      case AssumptionDataType.Enum:
        if (typeof value !== "string") {
          issues.push(`${assumption.name} must be a valid option.`);
          break;
        }
        if (Array.isArray(assumption.allowedValues) && assumption.allowedValues.length > 0 && !assumption.allowedValues.includes(value)) {
          issues.push(`${assumption.name} must be one of: ${assumption.allowedValues.join(", ")}.`);
        }
        break;
      default:
        issues.push(`${assumption.name} has an unsupported data type.`);
        break;
    }

    return issues;
  }

  validateProfile(input: Array<{ assumption: Assumption; value: unknown }>): ProfileValidationResult {
    const issues: ValidationIssue[] = [];

    for (const item of input) {
      const assumptionIssues = this.validateAssumption(item.assumption, item.value);
      for (const message of assumptionIssues) {
        issues.push({
          assumptionId: item.assumption.id,
          assumptionKey: item.assumption.key,
          message,
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  private validateRange(assumption: Assumption, value: number, issues: string[]) {
    if (assumption.minimum !== null && value < assumption.minimum) {
      issues.push(`${assumption.name} must be at least ${assumption.minimum}.`);
    }

    if (assumption.maximum !== null && value > assumption.maximum) {
      issues.push(`${assumption.name} must be at most ${assumption.maximum}.`);
    }
  }
}

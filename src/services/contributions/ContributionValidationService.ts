import type { ContributionPolicy, ContributionPolicyCreateInput, ContributionPolicyUpdateInput } from "@/types/contributionPolicy";

export interface ContributionValidationResult {
  isValid: boolean;
  issues: string[];
}

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function validateDates(startDate: string, endDate: string | null | undefined, issues: string[]) {
  if (!isValidDate(startDate)) {
    issues.push("Start date is invalid.");
  }

  if (endDate && !isValidDate(endDate)) {
    issues.push("End date is invalid.");
  }

  if (endDate && isValidDate(startDate) && isValidDate(endDate) && new Date(endDate) < new Date(startDate)) {
    issues.push("End date cannot be before start date.");
  }
}

function validateGrowth(input: {
  growthStrategy: ContributionPolicy["growthStrategy"];
  growthRate?: number | null;
  growthAmount?: number | null;
}, issues: string[]) {
  if (input.growthStrategy === "STEP_UP_PERCENTAGE") {
    if (input.growthRate === null || input.growthRate === undefined) {
      issues.push("Growth rate is required for percentage step-up.");
    } else if (input.growthRate < 0) {
      issues.push("Growth rate cannot be negative.");
    }
  }

  if (input.growthStrategy === "STEP_UP_AMOUNT") {
    if (input.growthAmount === null || input.growthAmount === undefined) {
      issues.push("Growth amount is required for amount step-up.");
    } else if (input.growthAmount < 0) {
      issues.push("Growth amount cannot be negative.");
    }
  }
}

function validateLimits(input: {
  minLimitAmount?: number | null;
  maxLimitAmount?: number | null;
  amount: number;
}, issues: string[]) {
  const min = input.minLimitAmount;
  const max = input.maxLimitAmount;

  if (min !== null && min !== undefined && min < 0) {
    issues.push("Minimum limit cannot be negative.");
  }

  if (max !== null && max !== undefined && max < 0) {
    issues.push("Maximum limit cannot be negative.");
  }

  if (min !== null && min !== undefined && max !== null && max !== undefined && max < min) {
    issues.push("Maximum limit cannot be less than minimum limit.");
  }

  if (min !== null && min !== undefined && input.amount < min) {
    issues.push("Contribution amount cannot be lower than minimum limit.");
  }

  if (max !== null && max !== undefined && input.amount > max) {
    issues.push("Contribution amount cannot exceed maximum limit.");
  }
}

function validateFormula(input: {
  formulaExpression?: string | null;
  formulaVariables?: Record<string, unknown> | null;
}, issues: string[]) {
  if (input.formulaExpression && !input.formulaVariables) {
    issues.push("Formula variables are required when formula expression is provided.");
  }
}

export class ContributionValidationService {
  validateCreate(input: ContributionPolicyCreateInput): ContributionValidationResult {
    const issues: string[] = [];

    if (!input.name.trim()) {
      issues.push("Policy name is required.");
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      issues.push("Contribution amount must be greater than zero.");
    }

    validateDates(input.startDate, input.endDate, issues);
    validateGrowth(input, issues);
    validateLimits(input, issues);
    validateFormula(input, issues);

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  validateUpdate(current: ContributionPolicy, input: ContributionPolicyUpdateInput): ContributionValidationResult {
    const merged: ContributionPolicyCreateInput = {
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      targetAccount: input.targetAccount ?? current.targetAccount,
      amount: input.amount ?? current.amount,
      currency: input.currency ?? current.currency,
      frequency: input.frequency ?? current.frequency,
      startDate: input.startDate ?? current.startDate,
      endDate: input.endDate ?? current.endDate,
      growthStrategy: input.growthStrategy ?? current.growthStrategy,
      growthRate: input.growthRate ?? current.growthRate,
      growthAmount: input.growthAmount ?? current.growthAmount,
      minLimitAmount: input.minLimitAmount ?? current.minLimitAmount,
      maxLimitAmount: input.maxLimitAmount ?? current.maxLimitAmount,
      cashProtectionEnabled: input.cashProtectionEnabled ?? current.cashProtectionEnabled,
      goalReference: input.goalReference ?? current.goalReference,
      formulaExpression: input.formulaExpression ?? current.formulaExpression,
      formulaVariables: input.formulaVariables ?? current.formulaVariables,
    };

    return this.validateCreate(merged);
  }
}

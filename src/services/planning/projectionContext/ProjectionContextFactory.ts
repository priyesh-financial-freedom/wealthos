import { ProjectionContextBuilder } from "./ProjectionContextBuilder";
import { ProjectionContextMapper } from "./ProjectionContextMapper";
import { ProjectionContextValidator } from "./ProjectionContextValidator";
import type {
  ProjectionContext,
  ProjectionContextBuildInput,
  ProjectionContextSerialized,
  ProjectionContextValidationIssue,
} from "./Types";

interface ProjectionContextFactoryDependencies {
  builder?: ProjectionContextBuilder;
  validator?: ProjectionContextValidator;
  mapper?: ProjectionContextMapper;
}

const EMPTY_SCENARIO = {
  id: "base",
  name: "Base",
  description: "Default planning scenario",
  startMonth: "1970-01",
  planningHorizonYear: 1970,
  assumptions: [],
  events: [],
  isDefault: true,
};

export class ProjectionContextFactory {
  private readonly builder: ProjectionContextBuilder;

  private readonly validator: ProjectionContextValidator;

  private readonly mapper: ProjectionContextMapper;

  constructor(dependencies: ProjectionContextFactoryDependencies = {}) {
    this.builder = dependencies.builder ?? new ProjectionContextBuilder();
    this.validator = dependencies.validator ?? new ProjectionContextValidator();
    this.mapper = dependencies.mapper ?? new ProjectionContextMapper();
  }

  create(input: ProjectionContextBuildInput): { context: ProjectionContext | null; issues: ProjectionContextValidationIssue[] } {
    return this.builder.build(input);
  }

  validate(input: ProjectionContextBuildInput): ProjectionContextValidationIssue[] {
    return this.validator.validate(input);
  }

  toSerializable(context: ProjectionContext): ProjectionContextSerialized {
    return this.mapper.toSerializable(context);
  }

  fromSerializable(serialized: ProjectionContextSerialized): { context: ProjectionContext | null; issues: ProjectionContextValidationIssue[] } {
    const mapped = this.mapper.fromSerializable(serialized);
    return this.builder.build(mapped);
  }

  createEmpty(): ProjectionContext {
    const result = this.builder.build({
      runId: "base",
      planningInputs: {},
      openingBalanceSnapshot: {
        id: "base",
        version: 1,
        effectiveDate: "1970-01-01",
        createdAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z",
        isActive: true,
        futureEffectiveDate: null,
        openingAssets: 0,
        openingLiabilities: 0,
        openingNetWorth: 0,
        cashPosition: 0,
        retirementCorpus: 0,
        investmentCorpus: 0,
        debtPosition: 0,
        assetAllocation: [],
        liabilityAllocation: [],
        sourceBalances: {
          assets: 0,
          liabilities: 0,
          bankAccounts: 0,
          investments: 0,
          retirementAccounts: 0,
          realEstate: 0,
          gold: 0,
          fixedDeposits: 0,
          otherAssets: 0,
        },
      },
      assumptions: {
        bundle: null,
        effective: null,
      },
      projectionStartDate: "1970-01-01",
      projectionEndDate: "1970-12-31",
      scenario: EMPTY_SCENARIO,
      monthlyLedger: [],
      events: [],
      goalSchedule: [],
      retirementSchedule: [],
      taxSchedule: [],
      cashFlowSchedule: [],
    });

    if (!result.context) {
      throw new Error("Failed to construct empty projection context.");
    }

    return result.context;
  }
}

export const projectionContextFactory = new ProjectionContextFactory();

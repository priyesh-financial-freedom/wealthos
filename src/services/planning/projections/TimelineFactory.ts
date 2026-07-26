import type {
  ProjectionMonth,
  TimelineGenerationInput,
  TimelineValidationIssue,
} from "./ProjectionMonth";
import { TimelineGenerator } from "./TimelineGenerator";
import { TimelineValidator } from "./TimelineValidator";

interface TimelineFactoryDependencies {
  generator?: TimelineGenerator;
  validator?: TimelineValidator;
}

export class TimelineFactory {
  private readonly generator: TimelineGenerator;

  private readonly validator: TimelineValidator;

  constructor(dependencies: TimelineFactoryDependencies = {}) {
    this.validator = dependencies.validator ?? new TimelineValidator();
    this.generator = dependencies.generator ?? new TimelineGenerator({
      validator: this.validator,
    });
  }

  create(input: TimelineGenerationInput): { timeline: readonly ProjectionMonth[] | null; issues: TimelineValidationIssue[] } {
    return this.generator.generate(input);
  }

  validate(input: TimelineGenerationInput): TimelineValidationIssue[] {
    return this.validator.validate(input);
  }

  createEmpty(): readonly ProjectionMonth[] {
    return Object.freeze([] as ProjectionMonth[]);
  }
}

export const timelineFactory = new TimelineFactory();

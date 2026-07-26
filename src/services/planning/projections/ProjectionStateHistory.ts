import type { ProjectionState, ProjectionStateSnapshot } from "./ProjectionState";
import { ProjectionStateBuilder } from "./ProjectionStateBuilder";
import { ProjectionStateValidator } from "./ProjectionStateValidator";
import { deepFreeze } from "../shared";

interface ProjectionStateHistoryDependencies {
  now?: () => Date;
  builder?: ProjectionStateBuilder;
  validator?: ProjectionStateValidator;
}

export class ProjectionStateHistory {
  private readonly snapshots: ProjectionStateSnapshot[] = [];

  private pointer = -1;

  private sequence = 0;

  private readonly now: () => Date;

  private readonly builder: ProjectionStateBuilder;

  private readonly validator: ProjectionStateValidator;

  constructor(dependencies: ProjectionStateHistoryDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date());
    this.builder = dependencies.builder ?? new ProjectionStateBuilder();
    this.validator = dependencies.validator ?? new ProjectionStateValidator();
  }

  append(params: {
    monthKey: string;
    step: string;
    state: ProjectionState;
    processor?: string;
    rule?: string | null;
    timestamp?: string;
  }): ProjectionStateSnapshot {
    this.sequence += 1;
    const recordedAt = params.timestamp ?? this.now().toISOString();
    const snapshot = this.builder.snapshot({
      state: params.state,
      monthKey: params.monthKey,
      step: params.step,
      index: this.snapshots.length,
      recordedAt,
      sequence: this.sequence,
      processor: params.processor ?? params.step,
      rule: params.rule ?? null,
      timestamp: recordedAt,
    });

    const issues = this.validator.validateSnapshot(snapshot);
    if (issues.length > 0) {
      throw new Error(`Invalid projection state snapshot at step ${params.step}.`);
    }

    const frozenSnapshot = deepFreeze(snapshot);
    this.snapshots.push(frozenSnapshot);
    this.pointer = this.snapshots.length - 1;
    return frozenSnapshot;
  }

  list(): readonly ProjectionStateSnapshot[] {
    return deepFreeze(this.snapshots.slice());
  }

  currentSnapshot(): ProjectionStateSnapshot | null {
    return this.pointer >= 0 ? this.snapshots[this.pointer] ?? null : null;
  }

  currentPointer(): number {
    return this.pointer;
  }

  at(index: number): ProjectionStateSnapshot | null {
    if (!Number.isInteger(index) || index < 0 || index >= this.snapshots.length) {
      return null;
    }

    return this.snapshots[index] ?? null;
  }

  rewindTo(index: number): ProjectionStateSnapshot {
    const target = this.at(index);
    if (!target) {
      throw new Error("Invalid rewind index.");
    }

    this.pointer = index;
    return target;
  }

  fastForwardTo(index: number): ProjectionStateSnapshot {
    return this.rewindTo(index);
  }

  materialize(index = this.pointer): ProjectionState {
    const snapshot = this.at(index);
    if (!snapshot) {
      throw new Error("Cannot materialize state for invalid history pointer.");
    }

    return this.builder.clone(snapshot);
  }
}

import type { ProjectionState, ProjectionStateSnapshot } from "./ProjectionState";
import { ProjectionStateBuilder } from "./ProjectionStateBuilder";

interface ProjectionStateHistoryPayload {
  snapshots: ProjectionStateSnapshot[];
  pointer: number;
}

export class ProjectionStateSerializer {
  private readonly builder = new ProjectionStateBuilder();

  serializeState(state: ProjectionState): string {
    return JSON.stringify(this.builder.clone(state));
  }

  deserializeState(payload: string): ProjectionState {
    const parsed = JSON.parse(payload) as Partial<ProjectionState>;
    return this.builder.create(parsed);
  }

  serializeSnapshots(snapshots: readonly ProjectionStateSnapshot[]): string {
    return JSON.stringify(snapshots.map((snapshot) => ({ ...snapshot })));
  }

  deserializeSnapshots(payload: string): ProjectionStateSnapshot[] {
    const parsed = JSON.parse(payload) as Array<ProjectionStateSnapshot>;
    return parsed.map((snapshot) => ({ ...snapshot }));
  }

  serializeHistory(input: ProjectionStateHistoryPayload): string {
    return JSON.stringify({
      snapshots: input.snapshots.map((snapshot) => ({ ...snapshot })),
      pointer: input.pointer,
    });
  }

  deserializeHistory(payload: string): ProjectionStateHistoryPayload {
    const parsed = JSON.parse(payload) as ProjectionStateHistoryPayload;
    return {
      snapshots: (parsed.snapshots ?? []).map((snapshot) => ({ ...snapshot })),
      pointer: Number(parsed.pointer ?? 0),
    };
  }
}

export const projectionStateSerializer = new ProjectionStateSerializer();

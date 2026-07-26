function stableHash(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface DeterministicPlanningRunIdInput {
  planningInputVersion: string;
  openingSnapshotVersion: string;
  scenarioId: string;
  projectionStart: string;
  projectionEnd: string;
}

export function buildDeterministicPlanningRunId(input: DeterministicPlanningRunIdInput): string {
  const payload = [
    `planning-input-version:${input.planningInputVersion}`,
    `opening-snapshot-version:${input.openingSnapshotVersion}`,
    `scenario-id:${input.scenarioId}`,
    `projection-start:${input.projectionStart}`,
    `projection-end:${input.projectionEnd}`,
  ].join("|");

  return `planning-run-${stableHash(payload)}`;
}

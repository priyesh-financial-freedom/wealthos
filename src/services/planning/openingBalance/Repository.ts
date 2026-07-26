import type { OpeningBalanceSnapshot } from "./OpeningBalanceSnapshot";

function nowIso() {
  return new Date().toISOString();
}

function effectiveAnchor(snapshot: OpeningBalanceSnapshot) {
  return snapshot.futureEffectiveDate ?? snapshot.effectiveDate;
}

export interface OpeningBalanceRepositoryContract {
  listVersions(snapshotId: string): Promise<OpeningBalanceSnapshot[]>;
  getVersion(snapshotId: string, version: number): Promise<OpeningBalanceSnapshot | null>;
  getActive(snapshotId: string, asOfDate?: string): Promise<OpeningBalanceSnapshot | null>;
  save(snapshot: OpeningBalanceSnapshot): Promise<OpeningBalanceSnapshot>;
  activate(snapshotId: string, version: number): Promise<OpeningBalanceSnapshot | null>;
}

export class OpeningBalanceRepository implements OpeningBalanceRepositoryContract {
  private readonly snapshots: OpeningBalanceSnapshot[] = [];

  async listVersions(snapshotId: string): Promise<OpeningBalanceSnapshot[]> {
    return this.snapshots
      .filter((snapshot) => snapshot.id === snapshotId)
      .slice()
      .sort((left, right) => right.version - left.version);
  }

  async getVersion(snapshotId: string, version: number): Promise<OpeningBalanceSnapshot | null> {
    return this.snapshots.find((snapshot) => snapshot.id === snapshotId && snapshot.version === version) ?? null;
  }

  async getActive(snapshotId: string, asOfDate?: string): Promise<OpeningBalanceSnapshot | null> {
    const anchor = asOfDate ?? new Date().toISOString().slice(0, 10);
    const candidates = this.snapshots
      .filter((snapshot) => snapshot.id === snapshotId)
      .filter((snapshot) => snapshot.isActive)
      .filter((snapshot) => effectiveAnchor(snapshot) <= anchor)
      .sort((left, right) => right.version - left.version);

    return candidates[0] ?? null;
  }

  async save(snapshot: OpeningBalanceSnapshot): Promise<OpeningBalanceSnapshot> {
    const existingIndex = this.snapshots.findIndex(
      (entry) => entry.id === snapshot.id && entry.version === snapshot.version,
    );

    if (snapshot.isActive) {
      for (let index = 0; index < this.snapshots.length; index += 1) {
        if (this.snapshots[index]?.id !== snapshot.id) {
          continue;
        }

        this.snapshots[index] = {
          ...this.snapshots[index],
          isActive: false,
          updatedAt: nowIso(),
        };
      }
    }

    if (existingIndex >= 0) {
      this.snapshots[existingIndex] = snapshot;
    } else {
      this.snapshots.push(snapshot);
    }

    return snapshot;
  }

  async activate(snapshotId: string, version: number): Promise<OpeningBalanceSnapshot | null> {
    const targetIndex = this.snapshots.findIndex(
      (entry) => entry.id === snapshotId && entry.version === version,
    );

    if (targetIndex < 0) {
      return null;
    }

    for (let index = 0; index < this.snapshots.length; index += 1) {
      if (this.snapshots[index]?.id !== snapshotId) {
        continue;
      }

      this.snapshots[index] = {
        ...this.snapshots[index],
        isActive: this.snapshots[index]?.version === version,
        updatedAt: nowIso(),
      };
    }

    return this.snapshots[targetIndex] ?? null;
  }
}

export const openingBalanceRepository: OpeningBalanceRepositoryContract = new OpeningBalanceRepository();

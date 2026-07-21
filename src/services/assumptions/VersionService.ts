import { AssumptionRepository } from "@/services/assumptions/AssumptionRepository";
import type { PolicyVersion } from "@/types/assumptions";

export class VersionService {
  constructor(private readonly repository: AssumptionRepository) {}

  async listVersions(userId: string, profileId: string): Promise<PolicyVersion[]> {
    return this.repository.listPolicyVersions(userId, profileId);
  }

  async createVersion(input: {
    userId: string;
    profileId: string;
    versionName?: string;
    notes?: string | null;
    snapshot: Record<string, unknown>;
  }): Promise<PolicyVersion> {
    const existing = await this.repository.listPolicyVersions(input.userId, input.profileId);
    const nextVersionNumber = existing.length > 0 ? existing[0].versionNumber + 1 : 1;

    return this.repository.createPolicyVersion({
      userId: input.userId,
      profileId: input.profileId,
      versionNumber: nextVersionNumber,
      versionName: input.versionName ?? `Version ${nextVersionNumber}`,
      notes: input.notes ?? null,
      snapshot: input.snapshot,
    });
  }
}

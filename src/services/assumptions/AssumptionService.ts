import { AssumptionRepository } from "@/services/assumptions/AssumptionRepository";
import { ValidationService } from "@/services/assumptions/ValidationService";
import { VersionService } from "@/services/assumptions/VersionService";
import { AssumptionValueSource } from "@/types/assumptions";
import type {
  Assumption,
  AssumptionCategory,
  AssumptionProfile,
  AssumptionWithValue,
  PolicyVersion,
  ProfileComparisonItem,
  ProfileValidationResult,
} from "@/types/assumptions";

export interface AssumptionProfilePayload {
  name: string;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface AssumptionUpdatePayload {
  profileId: string;
  assumptionId?: string;
  assumptionKey?: string;
  value: unknown;
}

export interface AssumptionProfileState {
  profile: AssumptionProfile;
  assumptions: AssumptionWithValue[];
  categories: AssumptionCategory[];
}

const DEFAULT_PROFILE_NAME = "Base Profile";

function valueByAssumptionId(values: AssumptionProfileState["assumptions"]): Map<string, unknown> {
  return new Map(values.map((item) => [item.id, item.currentValue]));
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class AssumptionService {
  private readonly versionService: VersionService;

  constructor(
    private readonly repository = new AssumptionRepository(),
    private readonly validationService = new ValidationService(),
  ) {
    this.versionService = new VersionService(this.repository);
  }

  async listProfiles(): Promise<AssumptionProfile[]> {
    const { user } = await this.repository.getAuthenticatedUser();
    return this.repository.listProfiles(user.id);
  }

  async listCategories(): Promise<AssumptionCategory[]> {
    return this.repository.listCategories();
  }

  async getCurrentProfile(): Promise<AssumptionProfileState> {
    const { user } = await this.repository.getAuthenticatedUser();
    const profiles = await this.repository.listProfiles(user.id);

    const activeProfile = profiles.find((profile) => profile.isActive) ?? profiles.find((profile) => profile.isDefault) ?? null;

    if (activeProfile) {
      return this.getProfile(activeProfile.id);
    }

    const bootstrapProfile = await this.createProfile({
      name: DEFAULT_PROFILE_NAME,
      description: "Default assumptions profile.",
      isActive: true,
      isDefault: true,
    });

    return this.getProfile(bootstrapProfile.id);
  }

  async getProfile(profileId: string): Promise<AssumptionProfileState> {
    const { user } = await this.repository.getAuthenticatedUser();
    const profile = await this.repository.getProfile(user.id, profileId);

    if (!profile) {
      throw new Error("Assumption profile not found.");
    }

    return this.buildProfileState(user.id, profile);
  }

  async createProfile(payload: AssumptionProfilePayload): Promise<AssumptionProfile> {
    const { user } = await this.repository.getAuthenticatedUser();
    const profiles = await this.repository.listProfiles(user.id);
    const isFirstProfile = profiles.length === 0;
    const isDefault = payload.isDefault ?? isFirstProfile;
    const isActive = payload.isActive ?? isFirstProfile;

    if (isDefault) {
      await this.repository.clearDefaultProfile(user.id);
    }

    if (isActive) {
      await this.repository.clearActiveProfile(user.id);
    }

    const profile = await this.repository.createProfile(user.id, {
      name: payload.name,
      description: payload.description ?? null,
      isDefault,
      isActive,
    });

    const assumptions = await this.repository.listAssumptions();
    await this.repository.bulkUpsertValues(
      assumptions.map((assumption) => ({
        userId: user.id,
        profileId: profile.id,
        assumptionId: assumption.id,
        value: assumption.defaultValue,
        source: AssumptionValueSource.System,
      })),
    );

    return profile;
  }

  async duplicateProfile(profileId: string, payload?: { name?: string; description?: string | null; isActive?: boolean }): Promise<AssumptionProfile> {
    const { user } = await this.repository.getAuthenticatedUser();
    const sourceState = await this.getProfile(profileId);

    if (payload?.isActive) {
      await this.repository.clearActiveProfile(user.id);
    }

    const duplicate = await this.repository.createProfile(user.id, {
      name: payload?.name ?? `${sourceState.profile.name} Copy`,
      description: payload?.description ?? sourceState.profile.description,
      isDefault: false,
      isActive: payload?.isActive ?? false,
    });

    await this.repository.bulkUpsertValues(
      sourceState.assumptions.map((assumption) => ({
        userId: user.id,
        profileId: duplicate.id,
        assumptionId: assumption.id,
        value: assumption.currentValue,
        source: AssumptionValueSource.User,
      })),
    );

    return duplicate;
  }

  async setActiveProfile(profileId: string): Promise<AssumptionProfile> {
    const { user } = await this.repository.getAuthenticatedUser();
    await this.repository.clearActiveProfile(user.id);
    return this.repository.updateProfile(user.id, profileId, { isActive: true });
  }

  async updateAssumption(payload: AssumptionUpdatePayload): Promise<AssumptionProfileState> {
    const { user } = await this.repository.getAuthenticatedUser();
    const profileState = await this.getProfile(payload.profileId);

    const assumption = this.resolveAssumption(profileState.assumptions, payload);
    const issues = this.validationService.validateAssumption(assumption, payload.value);

    if (issues.length > 0) {
      throw new Error(issues[0]);
    }

    await this.repository.upsertValue({
      userId: user.id,
      profileId: payload.profileId,
      assumptionId: assumption.id,
      value: payload.value,
      source: AssumptionValueSource.User,
    });

    return this.getProfile(payload.profileId);
  }

  async validateProfile(profileId: string): Promise<ProfileValidationResult> {
    const profileState = await this.getProfile(profileId);

    return this.validationService.validateProfile(
      profileState.assumptions.map((assumption) => ({
        assumption,
        value: assumption.currentValue,
      })),
    );
  }

  async compareProfiles(leftProfileId: string, rightProfileId: string): Promise<ProfileComparisonItem[]> {
    const left = await this.getProfile(leftProfileId);
    const right = await this.getProfile(rightProfileId);

    const leftMap = valueByAssumptionId(left.assumptions);
    const differences: ProfileComparisonItem[] = [];

    for (const rightAssumption of right.assumptions) {
      const leftValue = leftMap.get(rightAssumption.id);
      const rightValue = rightAssumption.currentValue;

      if (areValuesEqual(leftValue, rightValue)) {
        continue;
      }

      differences.push({
        assumptionId: rightAssumption.id,
        assumptionKey: rightAssumption.key,
        assumptionName: rightAssumption.name,
        categoryKey: rightAssumption.category.key,
        leftValue,
        rightValue,
      });
    }

    return differences;
  }

  async createVersion(profileId: string, payload?: { versionName?: string; notes?: string | null }): Promise<PolicyVersion> {
    const { user } = await this.repository.getAuthenticatedUser();
    const profileState = await this.getProfile(profileId);
    const snapshot = profileState.assumptions.reduce<Record<string, unknown>>((accumulator, assumption) => {
      accumulator[assumption.key] = assumption.currentValue;
      return accumulator;
    }, {});

    return this.versionService.createVersion({
      userId: user.id,
      profileId,
      versionName: payload?.versionName,
      notes: payload?.notes ?? null,
      snapshot,
    });
  }

  async listVersions(profileId: string): Promise<PolicyVersion[]> {
    const { user } = await this.repository.getAuthenticatedUser();
    return this.versionService.listVersions(user.id, profileId);
  }

  private resolveAssumption(assumptions: AssumptionWithValue[], payload: AssumptionUpdatePayload): Assumption {
    if (payload.assumptionId) {
      const byId = assumptions.find((item) => item.id === payload.assumptionId);
      if (byId) {
        return byId;
      }
    }

    if (payload.assumptionKey) {
      const byKey = assumptions.find((item) => item.key === payload.assumptionKey);
      if (byKey) {
        return byKey;
      }
    }

    throw new Error("Assumption definition not found for update.");
  }

  private async buildProfileState(userId: string, profile: AssumptionProfile): Promise<AssumptionProfileState> {
    const [categories, assumptions, values] = await Promise.all([
      this.repository.listCategories(),
      this.repository.listAssumptions(),
      this.repository.listValues(profile.id, userId),
    ]);

    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const valuesByAssumptionId = new Map(values.map((value) => [value.assumptionId, value]));

    const enrichedAssumptions: AssumptionWithValue[] = assumptions
      .map((assumption) => {
        const category = categoriesById.get(assumption.categoryId);
        if (!category) {
          return null;
        }

        const assumptionValue = valuesByAssumptionId.get(assumption.id);
        return {
          ...assumption,
          category,
          currentValue: assumptionValue?.value ?? assumption.defaultValue,
          valueId: assumptionValue?.id ?? null,
        };
      })
      .filter((assumption): assumption is AssumptionWithValue => assumption !== null);

    return {
      profile,
      categories,
      assumptions: enrichedAssumptions,
    };
  }
}

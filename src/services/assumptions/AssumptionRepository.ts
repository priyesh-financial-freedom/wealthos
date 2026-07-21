import { supabase } from "@/lib/supabase/client";
import type {
  Assumption,
  AssumptionCategory,
  AssumptionCategoryKey,
  AssumptionDataType,
  AssumptionProfile,
  AssumptionValue,
  AssumptionValueSource,
  PolicyVersion,
} from "@/types/assumptions";

interface AssumptionCategoryRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface AssumptionRow {
  id: string;
  category_id: string;
  key: string;
  name: string;
  description: string | null;
  data_type: string;
  unit: string | null;
  default_value: unknown;
  minimum_value: number | null;
  maximum_value: number | null;
  help_text: string | null;
  is_required: boolean;
  is_active: boolean;
  is_advanced_only: boolean;
  allowed_values: string[] | null;
  created_at: string;
  updated_at: string;
}

interface AssumptionProfileRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AssumptionValueRow {
  id: string;
  user_id: string;
  profile_id: string;
  assumption_id: string;
  value: unknown;
  source: string;
  created_at: string;
  updated_at: string;
}

interface PolicyVersionRow {
  id: string;
  user_id: string;
  profile_id: string;
  version_number: number;
  version_name: string;
  notes: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
}

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

function mapCategory(row: AssumptionCategoryRow): AssumptionCategory {
  return {
    id: row.id,
    key: row.key as AssumptionCategoryKey,
    name: row.name,
    description: row.description,
    displayOrder: Number(row.display_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssumption(row: AssumptionRow): Assumption {
  return {
    id: row.id,
    categoryId: row.category_id,
    key: row.key,
    name: row.name,
    description: row.description,
    dataType: row.data_type as AssumptionDataType,
    unit: row.unit,
    defaultValue: row.default_value,
    minimum: row.minimum_value,
    maximum: row.maximum_value,
    helpText: row.help_text,
    required: Boolean(row.is_required),
    isActive: Boolean(row.is_active),
    advancedOnly: Boolean(row.is_advanced_only),
    allowedValues: row.allowed_values,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfile(row: AssumptionProfileRow): AssumptionProfile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapValue(row: AssumptionValueRow): AssumptionValue {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    assumptionId: row.assumption_id,
    value: row.value,
    source: row.source as AssumptionValueSource,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersion(row: PolicyVersionRow): PolicyVersion {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    versionNumber: Number(row.version_number ?? 0),
    versionName: row.version_name,
    notes: row.notes,
    snapshot: row.snapshot,
    createdAt: row.created_at,
  };
}

export class AssumptionRepository {
  async getAuthenticatedUser() {
    const client = assertSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
      throw new Error("Authentication required.");
    }

    return { client, user };
  }

  async listCategories(): Promise<AssumptionCategory[]> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client.from("assumption_categories").select("*").order("display_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapCategory(row as AssumptionCategoryRow));
  }

  async listAssumptions(): Promise<Assumption[]> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("assumptions")
      .select("*")
      .eq("is_active", true)
      .order("category_id", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapAssumption(row as AssumptionRow));
  }

  async listProfiles(userId: string): Promise<AssumptionProfile[]> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client.from("assumption_profiles").select("*").eq("user_id", userId).order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapProfile(row as AssumptionProfileRow));
  }

  async getProfile(userId: string, profileId: string): Promise<AssumptionProfile | null> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client.from("assumption_profiles").select("*").eq("user_id", userId).eq("id", profileId).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return mapProfile(data as AssumptionProfileRow);
  }

  async createProfile(userId: string, input: { name: string; description?: string | null; isDefault: boolean; isActive: boolean }): Promise<AssumptionProfile> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("assumption_profiles")
      .insert({
        user_id: userId,
        name: input.name,
        description: input.description ?? null,
        is_default: input.isDefault,
        is_active: input.isActive,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapProfile(data as AssumptionProfileRow);
  }

  async updateProfile(userId: string, profileId: string, patch: { name?: string; description?: string | null; isDefault?: boolean; isActive?: boolean }): Promise<AssumptionProfile> {
    const { client } = await this.getAuthenticatedUser();
    const updatePayload: Record<string, unknown> = {};

    if (patch.name !== undefined) {
      updatePayload.name = patch.name;
    }
    if (patch.description !== undefined) {
      updatePayload.description = patch.description;
    }
    if (patch.isDefault !== undefined) {
      updatePayload.is_default = patch.isDefault;
    }
    if (patch.isActive !== undefined) {
      updatePayload.is_active = patch.isActive;
    }

    const { data, error } = await client
      .from("assumption_profiles")
      .update(updatePayload)
      .eq("user_id", userId)
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapProfile(data as AssumptionProfileRow);
  }

  async clearDefaultProfile(userId: string): Promise<void> {
    const { client } = await this.getAuthenticatedUser();
    const { error } = await client.from("assumption_profiles").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);

    if (error) {
      throw new Error(error.message);
    }
  }

  async clearActiveProfile(userId: string): Promise<void> {
    const { client } = await this.getAuthenticatedUser();
    const { error } = await client.from("assumption_profiles").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);

    if (error) {
      throw new Error(error.message);
    }
  }

  async listValues(profileId: string, userId: string): Promise<AssumptionValue[]> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client.from("assumption_values").select("*").eq("user_id", userId).eq("profile_id", profileId);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapValue(row as AssumptionValueRow));
  }

  async upsertValue(input: {
    userId: string;
    profileId: string;
    assumptionId: string;
    value: unknown;
    source: AssumptionValueSource;
  }): Promise<AssumptionValue> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("assumption_values")
      .upsert(
        {
          user_id: input.userId,
          profile_id: input.profileId,
          assumption_id: input.assumptionId,
          value: input.value,
          source: input.source,
        },
        { onConflict: "profile_id,assumption_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapValue(data as AssumptionValueRow);
  }

  async bulkUpsertValues(
    values: Array<{
      userId: string;
      profileId: string;
      assumptionId: string;
      value: unknown;
      source: AssumptionValueSource;
    }>,
  ): Promise<void> {
    if (values.length === 0) {
      return;
    }

    const { client } = await this.getAuthenticatedUser();
    const { error } = await client
      .from("assumption_values")
      .upsert(
        values.map((item) => ({
          user_id: item.userId,
          profile_id: item.profileId,
          assumption_id: item.assumptionId,
          value: item.value,
          source: item.source,
        })),
        { onConflict: "profile_id,assumption_id" },
      );

    if (error) {
      throw new Error(error.message);
    }
  }

  async listPolicyVersions(userId: string, profileId: string): Promise<PolicyVersion[]> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("policy_versions")
      .select("*")
      .eq("user_id", userId)
      .eq("profile_id", profileId)
      .order("version_number", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapVersion(row as PolicyVersionRow));
  }

  async createPolicyVersion(input: {
    userId: string;
    profileId: string;
    versionNumber: number;
    versionName: string;
    notes?: string | null;
    snapshot: Record<string, unknown>;
  }): Promise<PolicyVersion> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("policy_versions")
      .insert({
        user_id: input.userId,
        profile_id: input.profileId,
        version_number: input.versionNumber,
        version_name: input.versionName,
        notes: input.notes ?? null,
        snapshot: input.snapshot,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapVersion(data as PolicyVersionRow);
  }
}

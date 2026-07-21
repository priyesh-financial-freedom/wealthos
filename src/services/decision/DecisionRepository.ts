import { supabase } from "@/lib/supabase/client";
import type { DecisionRecommendation, DecisionRepositoryRecord, DecisionStatus } from "./DecisionTypes";

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

async function requireAuthenticatedUser() {
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

function mapRecordToRecommendation(record: DecisionRepositoryRecord): DecisionRecommendation {
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    priority: record.priority,
    severity: record.severity,
    reason: record.reason,
    recommendedAction: record.recommended_action,
    expectedBenefit: record.expected_benefit,
    confidence: Number(record.confidence ?? 0),
    status: record.status,
    createdAt: record.created_at,
  };
}

export class DecisionRepository {
  async listRecommendations(): Promise<DecisionRecommendation[]> {
    const { client, user } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("decision_recommendations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as DecisionRepositoryRecord[]).map(mapRecordToRecommendation);
  }

  async upsertRecommendations(recommendations: DecisionRecommendation[]): Promise<void> {
    const { client, user } = await requireAuthenticatedUser();

    if (recommendations.length === 0) {
      return;
    }

    const { error } = await client.from("decision_recommendations").upsert(
      recommendations.map((recommendation) => ({
        id: recommendation.id,
        user_id: user.id,
        title: recommendation.title,
        category: recommendation.category,
        priority: recommendation.priority,
        severity: recommendation.severity,
        reason: recommendation.reason,
        recommended_action: recommendation.recommendedAction,
        expected_benefit: recommendation.expectedBenefit,
        confidence: recommendation.confidence,
        status: recommendation.status,
      })),
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateStatus(id: string, status: DecisionStatus): Promise<void> {
    const { client, user } = await requireAuthenticatedUser();
    const { error } = await client.from("decision_recommendations").update({ status }).eq("user_id", user.id).eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export const decisionRepository = new DecisionRepository();

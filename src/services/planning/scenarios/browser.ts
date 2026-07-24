import { supabase } from "@/lib/supabase/client";

import { PlanningScenarioRepository } from "./PlanningScenarioRepository";
import { createPlanningScenarioSimulationEngine, PlanningScenarioService } from "./PlanningScenarioService";

function createBrowserPlanningScenarioRepository() {
  return new PlanningScenarioRepository(async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    return supabase;
  });
}

export function createPlanningScenarioBrowserService() {
  const repository = createBrowserPlanningScenarioRepository();

  return new PlanningScenarioService({
    repository,
    simulationEngine: createPlanningScenarioSimulationEngine({
      snapshotProvider: {
        loadSnapshot: async () => {
          const userId = await repository.getAuthenticatedUserId();
          return repository.loadLatestMonthEndSnapshot(userId);
        },
      },
    }),
  });
}

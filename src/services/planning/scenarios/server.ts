import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PlanningScenarioRepository } from "./PlanningScenarioRepository";
import { createPlanningScenarioSimulationEngine, PlanningScenarioService } from "./PlanningScenarioService";

export function createPlanningScenarioServerService() {
  const repository = new PlanningScenarioRepository(() => createSupabaseServerClient());

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

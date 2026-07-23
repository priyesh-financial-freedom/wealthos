import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PlanningAssumptionRepository } from "./AssumptionRepository";
import { PlanningAssumptionService } from "./AssumptionService";

export function createPlanningAssumptionServerService() {
  return new PlanningAssumptionService({
    repository: new PlanningAssumptionRepository(() => createSupabaseServerClient()),
  });
}
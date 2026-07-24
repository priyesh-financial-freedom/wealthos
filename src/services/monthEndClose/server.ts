import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MonthEndCloseRepository } from "./MonthEndCloseRepository";
import { MonthEndCloseService } from "./MonthEndCloseService";

export function createMonthEndCloseServerService() {
  return new MonthEndCloseService({
    repository: new MonthEndCloseRepository(() => createSupabaseServerClient()),
  });
}

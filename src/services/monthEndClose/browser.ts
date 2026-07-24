import { supabase } from "@/lib/supabase/client";

import { MonthEndCloseRepository } from "./MonthEndCloseRepository";
import { MonthEndCloseService } from "./MonthEndCloseService";

function createBrowserMonthEndCloseRepository() {
  return new MonthEndCloseRepository(async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    return supabase;
  });
}

export function createMonthEndCloseBrowserService() {
  return new MonthEndCloseService({
    repository: createBrowserMonthEndCloseRepository(),
  });
}

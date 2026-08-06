import type { MonthEndClosePersistInput } from "@/types/monthEndClose";
import { supabase } from "@/lib/supabase/client";
import { SupabaseMonthEndCloseDomainRepository } from "@/domain/services/MonthEndCloseDomainRepository";
import { MonthEndCloseDomainService } from "@/domain/services/MonthEndCloseDomainService";

import { createMonthEndCloseBrowserService } from "./browser";

export { MonthEndCloseRepository } from "./MonthEndCloseRepository";
export { calculateMonthEndCloseVarianceSummary, MonthEndCloseService } from "./MonthEndCloseService";
export { createMonthEndCloseBrowserService } from "./browser";

export const monthEndCloseService = createMonthEndCloseBrowserService();

export async function getMonthEndCloseWorkspace() {
  return monthEndCloseService.getWorkspace();
}

export async function getLatestClosedMonthEndCloseItems() {
  return monthEndCloseService.getLatestClosedItems();
}

export async function saveMonthEndCloseDraft(input: MonthEndClosePersistInput) {
  return monthEndCloseService.saveDraft(input);
}

export async function closeMonthEndClose(input: MonthEndClosePersistInput) {
  return monthEndCloseService.closeMonth(input);
}

export async function reopenMonth(params: { closeId: string; reason: string }) {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const client = supabase;
  const repository = new SupabaseMonthEndCloseDomainRepository(async () => client);
  const domainService = new MonthEndCloseDomainService(repository);
  const userId = await domainService.getAuthenticatedUserId();
  return domainService.reopenMonth(userId, params.closeId, params.reason);
}

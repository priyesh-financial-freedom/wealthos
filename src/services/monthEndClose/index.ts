import type { MonthEndClosePersistInput } from "@/types/monthEndClose";

import { createMonthEndCloseBrowserService } from "./browser";

export { MonthEndCloseRepository } from "./MonthEndCloseRepository";
export { calculateMonthEndCloseVarianceSummary, MonthEndCloseService } from "./MonthEndCloseService";
export { createMonthEndCloseBrowserService } from "./browser";

export const monthEndCloseService = createMonthEndCloseBrowserService();

export async function getMonthEndCloseWorkspace() {
  return monthEndCloseService.getWorkspace();
}

export async function saveMonthEndCloseDraft(input: MonthEndClosePersistInput) {
  return monthEndCloseService.saveDraft(input);
}

export async function closeMonthEndClose(input: MonthEndClosePersistInput) {
  return monthEndCloseService.closeMonth(input);
}

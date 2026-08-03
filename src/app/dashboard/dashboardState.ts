import type { ExecutiveDashboardData } from "@/components/dashboard/dashboardTypes";

export function mergeOptionalDashboardData(
  current: ExecutiveDashboardData | null,
  optionalData: Partial<ExecutiveDashboardData>,
): ExecutiveDashboardData | null {
  return current ? { ...current, ...optionalData } : current;
}

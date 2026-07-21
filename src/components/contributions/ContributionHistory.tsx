import { History } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { ContributionEvent, ContributionHistory as ContributionHistoryRecord } from "@/types/contributionPolicy";

interface ContributionHistoryProps {
  history: ContributionHistoryRecord[];
  events: ContributionEvent[];
}

function eventLabel(eventType: ContributionEvent["eventType"]) {
  return eventType.replaceAll("_", " ");
}

export function ContributionHistory({ history, events }: ContributionHistoryProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <DashboardCard>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-700" />
          <h3 className="text-base font-semibold text-slate-900">History</h3>
        </div>
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">No policy history recorded yet.</p>
          ) : (
            history.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">{eventLabel(item.changeType)}</p>
                <p className="mt-1 text-sm text-slate-800">{item.notes || "Snapshot recorded"}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(item.recordedAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-700" />
          <h3 className="text-base font-semibold text-slate-900">Events</h3>
        </div>
        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">No policy events recorded yet.</p>
          ) : (
            events.slice(0, 12).map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">{eventLabel(event.eventType)}</p>
                <p className="mt-1 text-xs text-slate-600">{new Date(event.occurredAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </DashboardCard>
    </div>
  );
}
